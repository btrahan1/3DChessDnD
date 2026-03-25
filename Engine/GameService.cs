using System;
using System.Threading.Tasks;
using Microsoft.JSInterop;

namespace ChessDnD.Engine
{
    public class GameService
    {
        private readonly IJSRuntime _js;
        public Board Board { get; private set; }
        public Color CurrentTurn { get; private set; } = Color.White;
        public Piece? SelectedPiece => (_selectedRow.HasValue && _selectedCol.HasValue) ? Board.GetPiece(_selectedRow.Value, _selectedCol.Value) : null;
        public string LastCombatMessage { get; private set; } = "Ready for Battle!";
        public string? ActiveSpell { get; private set; }

        public event Action? OnStateChanged;

        private int? _selectedRow;
        private int? _selectedCol;

        public async Task ToggleSpell(string? spell)
        {
            ActiveSpell = (ActiveSpell == spell) ? null : spell;
            await _js.InvokeVoidAsync("setSpellMode", ActiveSpell != null);
            OnStateChanged?.Invoke();
        }

        public GameService(IJSRuntime js)
        {
            _js = js;
            Board = new Board();
        }

        [JSInvokable]
        public async Task OnSquareClick(int row, int col)
        {
            // --- Spell targeting takes priority ---
            if (ActiveSpell == "Heal")
            {
                var target = Board.GetPiece(row, col);
                var caster = SelectedPiece;
                if (target != null && caster != null && target.Color == caster.Color)
                {
                    // Heal: restore 50% MaxHP, capped at MaxHP
                    int healAmount = Math.Max(1, target.MaxHP / 2);
                    target.HP = Math.Min(target.MaxHP, target.HP + healAmount);
                    LastCombatMessage = $"{caster.Type} heals {target.Type} for {healAmount} HP!";
                    Console.WriteLine(LastCombatMessage);

                    // End spell mode, end turn
                    ActiveSpell = null;
                    _selectedRow = null;
                    _selectedCol = null;
                    CurrentTurn = (CurrentTurn == Color.White) ? Color.Black : Color.White;

                    await _js.InvokeVoidAsync("setSelectedPiece", null, null);
                    await _js.InvokeVoidAsync("setSpellMode", false);
                    var state = Board.GetFullState();
                    await _js.InvokeVoidAsync("syncGameState", System.Text.Json.JsonSerializer.Serialize(state));
                    OnStateChanged?.Invoke();
                }
                else if (target != null)
                {
                    LastCombatMessage = "Can only heal friendly pieces!";
                    OnStateChanged?.Invoke();
                }
                return; // Always return, don't fall through to normal selection
            }

            if (_selectedRow == null)
            {
                // Selecting a piece
                var piece = Board.GetPiece(row, col);
                if (piece != null && piece.Color == CurrentTurn)
                {
                    _selectedRow = row;
                    _selectedCol = col;
                    ActiveSpell = null; // Reset spell on new selection
                    await _js.InvokeVoidAsync("setSelectedPiece", row, col);
                    Console.WriteLine($"Selected {piece.Type} at {row},{col}. Invoking StateChanged.");
                    OnStateChanged?.Invoke(); // Tell Blazor UI to refresh
                }
            }
            else
            {
                var fromRow = _selectedRow.Value;
                var fromCol = _selectedCol.Value;
                await _js.InvokeVoidAsync("setSelectedPiece", null, null);
                var piece = Board.GetPiece(fromRow, fromCol);
                var target = Board.GetPiece(row, col);

                if (piece != null && piece.IsValidMove(row, col, Board))
                {
                    // Friendly fire prevention
                    if (target != null && target.Color == piece.Color)
                    {
                        LastCombatMessage = "Can't attack a friendly piece!";
                        _selectedRow = null;
                        _selectedCol = null;
                        OnStateChanged?.Invoke();
                        return;
                    }

                    bool moveExecuted = true;
                    if (target != null)
                    {
                        var combat = Board.ResolveCombat(piece, target);
                        LastCombatMessage = combat.Message;
                        moveExecuted = combat.IsVictory;
                    }
                    else
                    {
                        LastCombatMessage = "Moving...";
                    }

                    if (moveExecuted)
                    {
                        Board.MovePiece(fromRow, fromCol, row, col);
                        CurrentTurn = (CurrentTurn == Color.White) ? Color.Black : Color.White;
                        await _js.InvokeVoidAsync("updatePiecePosition", fromRow, fromCol, row, col);
                    }
                    
                    // Sync the full state (HP, Presence) to JS
                    var state = Board.GetFullState();
                    await _js.InvokeVoidAsync("syncGameState", System.Text.Json.JsonSerializer.Serialize(state));

                    OnStateChanged?.Invoke();
                }
                
                _selectedRow = null;
                _selectedCol = null;
            }
        }
    }
}
