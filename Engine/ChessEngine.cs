using System;

namespace ChessDnD.Engine
{
    public enum PieceType { Pawn, Knight, Bishop, Rook, Queen, King }
    public enum Color { White, Black }

    public class CombatResult
    {
        public bool IsVictory { get; set; }
        public int AttackerRoll { get; set; }
        public int DamageDealt { get; set; }
        public int DefenderRemainingHP { get; set; }
        public string Message { get; set; } = "";
    }

    public abstract class Piece
    {
        public PieceType Type { get; set; }
        public Color Color { get; set; }
        public int HP { get; set; }
        public int MaxHP { get; set; }
        public int Attack { get; set; }
        public int Defense { get; set; }
        public int Row { get; set; }
        public int Col { get; set; }

        protected Piece(PieceType type, Color color, int hp, int attack, int defense)
        {
            Type = type;
            Color = color;
            HP = hp;
            MaxHP = hp;
            Attack = attack;
            Defense = defense;
        }

        public abstract bool IsValidMove(int targetRow, int targetCol, Board board);
    }

    public class Pawn : Piece
    {
        public Pawn(Color color) : base(PieceType.Pawn, color, 10, 2, 1) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            int direction = Color == Color.White ? 1 : -1;
            int startRow = Color == Color.White ? 1 : 6;

            // Standard one-square move
            if (targetCol == Col && targetRow == Row + direction && board.GetPiece(targetRow, targetCol) == null)
                return true;

            // Two-square initial move
            if (targetCol == Col && Row == startRow && targetRow == Row + (2 * direction) &&
                board.GetPiece(Row + direction, Col) == null && board.GetPiece(targetRow, targetCol) == null)
                return true;

            // Capture
            if (Math.Abs(targetCol - Col) == 1 && targetRow == Row + direction && board.GetPiece(targetRow, targetCol) != null)
                return true;

            return false;
        }
    }

    public class Knight : Piece
    {
        public Knight(Color color) : base(PieceType.Knight, color, 15, 4, 2) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            int dRow = Math.Abs(targetRow - Row);
            int dCol = Math.Abs(targetCol - Col);
            return (dRow == 2 && dCol == 1) || (dRow == 1 && dCol == 2);
        }
    }

    public class Bishop : Piece
    {
        public Bishop(Color color) : base(PieceType.Bishop, color, 12, 3, 1) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            if (Math.Abs(targetRow - Row) != Math.Abs(targetCol - Col)) return false;
            return board.IsPathClear(Row, Col, targetRow, targetCol);
        }
    }

    public class Rook : Piece
    {
        public Rook(Color color) : base(PieceType.Rook, color, 20, 4, 4) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            if (targetRow != Row && targetCol != Col) return false;
            return board.IsPathClear(Row, Col, targetRow, targetCol);
        }
    }

    public class Queen : Piece
    {
        public Queen(Color color) : base(PieceType.Queen, color, 25, 6, 3) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            if (Math.Abs(targetRow - Row) != Math.Abs(targetCol - Col) && targetRow != Row && targetCol != Col) return false;
            return board.IsPathClear(Row, Col, targetRow, targetCol);
        }
    }

    public class King : Piece
    {
        public King(Color color) : base(PieceType.King, color, 30, 5, 5) { }
        public override bool IsValidMove(int targetRow, int targetCol, Board board)
        {
            return Math.Abs(targetRow - Row) <= 1 && Math.Abs(targetCol - Col) <= 1;
        }
    }

    public class Board
    {
        private Piece[,] squares = new Piece[8, 8];
        public Board() { Initialize(); }

        private void Initialize()
        {
            AddPiece(new Rook(Color.White), 0, 0);
            AddPiece(new Knight(Color.White), 0, 1);
            AddPiece(new Bishop(Color.White), 0, 2);
            AddPiece(new Queen(Color.White), 0, 3);
            AddPiece(new King(Color.White), 0, 4);
            AddPiece(new Bishop(Color.White), 0, 5);
            AddPiece(new Knight(Color.White), 0, 6);
            AddPiece(new Rook(Color.White), 0, 7);
            for (int i = 0; i < 8; i++) AddPiece(new Pawn(Color.White), 1, i);

            AddPiece(new Rook(Color.Black), 7, 0);
            AddPiece(new Knight(Color.Black), 7, 1);
            AddPiece(new Bishop(Color.Black), 7, 2);
            AddPiece(new Queen(Color.Black), 7, 3);
            AddPiece(new King(Color.Black), 7, 4);
            AddPiece(new Bishop(Color.Black), 7, 5);
            AddPiece(new Knight(Color.Black), 7, 6);
            AddPiece(new Rook(Color.Black), 7, 7);
            for (int i = 0; i < 8; i++) AddPiece(new Pawn(Color.Black), 6, i);
        }

        private void AddPiece(Piece piece, int row, int col) { squares[row, col] = piece; piece.Row = row; piece.Col = col; }
        public Piece GetPiece(int row, int col) => squares[row, col];

        public bool IsPathClear(int startRow, int startCol, int endRow, int endCol)
        {
            int dRow = Math.Sign(endRow - startRow);
            int dCol = Math.Sign(endCol - startCol);
            int r = startRow + dRow;
            int c = startCol + dCol;
            while (r != endRow || c != endCol) { if (squares[r, c] != null) return false; r += dRow; c += dCol; }
            return true;
        }
        
        public CombatResult ResolveCombat(Piece attacker, Piece defender)
        {
            var random = new Random();
            int roll = random.Next(1, 21);
            int attackScore = roll + attacker.Attack;
            var result = new CombatResult { AttackerRoll = roll };
            if (attackScore >= defender.Defense + 10) {
                int damage = attacker.Attack + random.Next(1, 7);
                defender.HP -= damage;
                result.IsVictory = defender.HP <= 0;
                result.DamageDealt = damage;
                result.DefenderRemainingHP = Math.Max(0, defender.HP);
                result.Message = $"Hit! Dealt {damage} damage.";
            } else {
                result.IsVictory = false;
                result.Message = "Missed!";
            }
            if (result.IsVictory) squares[defender.Row, defender.Col] = null;
            return result;
        }

        public void MovePiece(int fromRow, int fromCol, int toRow, int toCol)
        {
            var piece = squares[fromRow, fromCol];
            if (piece != null) {
                var target = squares[toRow, toCol];
                if (target != null && target.Color != piece.Color) {
                    var combat = ResolveCombat(piece, target);
                    if (!combat.IsVictory) return;
                }
                squares[toRow, toCol] = piece;
                squares[fromRow, fromCol] = null;
                piece.Row = toRow;
                piece.Col = toCol;
            }
        }
    }
}
