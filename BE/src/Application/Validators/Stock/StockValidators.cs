using Application.DTOs.GoodsReceipts;
using Application.DTOs.Stock;
using Application.Validators.Common;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.StockAdjustments;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Pos;
using Domain.Enums.Inventory.StockAdjustments;
using FluentValidation;

namespace Application.Validators.Stock;

public sealed class CreateStockAdjustmentRequestValidator : AppValidator<CreateStockAdjustmentRequest>
{
    public CreateStockAdjustmentRequestValidator()
    {
        RuleFor(x => x.Reason).IsInEnum().WithMessage("Lý do không hợp lệ");
        RuleFor(x => x.Note).NotEmpty().When(x => x.Reason == AdjustmentReason.Khac).WithMessage("Nhập ghi chú")
            .MaximumLength(StockAdjustment.NoteMaxLength);
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Thêm ít nhất một mặt hàng")
            .Must(lines => lines.Select(l => l.ProductId).Distinct().Count() == lines.Count).WithMessage("Mặt hàng bị trùng");
        RuleForEach(x => x.Lines).ChildRules(line =>
            line.RuleFor(l => l.ActualQty).GreaterThanOrEqualTo(0).WithMessage("Số lượng thực tế không âm"));
    }
}

public sealed class StockAdjustmentQueryValidator : AppValidator<StockAdjustmentQuery>
{
    public StockAdjustmentQueryValidator() => this.DateRange(x => x.From, x => x.To);
}

public sealed class SaveSupplierRequestValidator : AppValidator<SaveSupplierRequest>
{
    public SaveSupplierRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên nhà cung cấp").MaximumLength(Supplier.NameMaxLength);
        RuleFor(x => x.Phone).OptionalVnPhone();
        RuleFor(x => x.Address).MaximumLength(Supplier.AddressMaxLength);
        RuleFor(x => x.Note).MaximumLength(Supplier.NoteMaxLength);
    }
}

public sealed class SaveGoodsReceiptRequestValidator : AppValidator<SaveGoodsReceiptRequest>
{
    public SaveGoodsReceiptRequestValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty().WithMessage("Chọn nhà cung cấp");
        RuleFor(x => x.Note).MaximumLength(GoodsReceipt.NoteMaxLength);
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Thêm ít nhất một mặt hàng");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).NotEmpty().WithMessage("Chọn mặt hàng");
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Số lượng lớn hơn 0")
                .LessThanOrEqualTo(PosRules.MaxLineQuantity * 100).WithMessage("Số lượng quá lớn");
            line.RuleFor(l => l.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("Đơn giá không âm");
        });
    }
}

public sealed class GoodsReceiptQueryValidator : AppValidator<GoodsReceiptQuery>
{
    public GoodsReceiptQueryValidator() => this.DateRange(x => x.From, x => x.To);
}
