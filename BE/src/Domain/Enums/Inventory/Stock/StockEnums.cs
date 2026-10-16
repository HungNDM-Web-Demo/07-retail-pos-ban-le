namespace Domain.Enums.Inventory.Stock;

/// <summary>Trạng thái tồn suy ra từ tồn và tồn tối thiểu (BR-26), không lưu.</summary>
public enum StockStatus
{
    AmKho = 0,
    HetHang = 1,
    SapHet = 2,
    ConHang = 3
}

/// <summary>Loại dòng sổ biến động tồn (06 §4 <c>Inventory_StockMovements</c>).</summary>
public enum MovementType
{
    TonDau = 0,
    BanHang = 1,
    TraHang = 2,
    NhapHang = 3,
    DieuChinh = 4
}

/// <summary>Trạng thái lô theo hạn sử dụng (BR-27), tính lúc đọc.</summary>
public enum LotStatus
{
    ConHan = 0,
    SapHetHan = 1,
    DaHetHan = 2
}
