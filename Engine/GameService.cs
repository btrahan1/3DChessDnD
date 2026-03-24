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
        public string LastCombatMessage { get; private set; } = "Ready for Battle!";

        public event Action? OnStateChanged;

        private int? _selectedRow;
        private int? _selectedCol;

        public GameService(IJSRuntime js)
        {
            _js = js;
            Board = new Board();
        }

        [JSInvokable]
        public async Task OnSquareClick(int row, int col)
        {
            if (_selectedRow == null)
            {
                // Selecting a piece
                var piece = Board.GetPiece(row, col);
                if (piece != null && piece.Color == CurrentTurn)
                {
                    _selectedRow = row;
                    _selectedCol = col;
                    await _js.InvokeVoidAsync("setSelectedPiece", row, col);
                    Console.WriteLine($"Selected {piece.Type} at {row},{col}");
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
                    bool moveExecuted = true;
                    if (target != null && target.Color != piece.Color)
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
                    
                    OnStateChanged?.Invoke();
                }
                
                _selectedRow = null;
                _selectedCol = null;
            }
        }
    }
}
