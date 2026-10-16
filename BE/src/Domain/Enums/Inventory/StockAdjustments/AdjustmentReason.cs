namespace Domain.Enums.Inventory.StockAdjustments;

/// <summary>Lý do điều chỉnh tồn (06 §4 <c>Inventory_StockAdjustments</c>).</summary>
public enum AdjustmentReason
{
    Hong = 0,
    HetHan = 1,
    Mat = 2,
    DemLai = 3,
    Khac = 4
}
