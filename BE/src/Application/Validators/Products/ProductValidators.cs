using System.Text.RegularExpressions;
using Application.DTOs.Products;
using Application.Validators.Common;
using Domain.Entities.Inventory.ProductGroups;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Pos;
using FluentValidation;

namespace Application.Validators.Products;

public sealed partial class SaveProductGroupRequestValidator : AppValidator<SaveProductGroupRequest>
{
    public SaveProductGroupRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên nhóm hàng")
            .MaximumLength(ProductGroup.NameMaxLength).WithMessage($"Tên nhóm hàng tối đa {ProductGroup.NameMaxLength} ký tự");
        RuleFor(x => x.Color).Must(c => c is not null && ColorRegex().IsMatch(c)).WithMessage("Màu dạng #RRGGBB");
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    internal static partial Regex ColorRegex();
}

public sealed class ReorderProductGroupsRequestValidator : AppValidator<ReorderProductGroupsRequest>
{
    public ReorderProductGroupsRequestValidator()
    {
        RuleFor(x => x.Ids).NotEmpty().WithMessage("Danh sách nhóm không đầy đủ")
            .Must(ids => ids.Distinct().Count() == ids.Count).WithMessage("Danh sách nhóm không đầy đủ");
    }
}

/// <summary>Kiểm tra khi lưu mặt hàng theo thứ tự 07 §2.2 (mã vạch trùng, đơn vị đã dùng kiểm ở service).</summary>
public sealed class SaveProductRequestValidator : AppValidator<SaveProductRequest>
{
    public const string BarcodeMessage = "Mã vạch gồm 8 đến 14 chữ số";

    public SaveProductRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên mặt hàng")
            .MaximumLength(Product.NameMaxLength).WithMessage($"Tên mặt hàng tối đa {Product.NameMaxLength} ký tự");
        RuleFor(x => x.GroupId).NotEmpty().WithMessage("Chọn nhóm hàng");
        RuleFor(x => x.BaseUnit).NotEmpty().WithMessage("Nhập đơn vị cơ bản")
            .MaximumLength(ProductUnit.NameMaxLength).WithMessage($"Tên đơn vị tối đa {ProductUnit.NameMaxLength} ký tự");
        RuleFor(x => x.Barcode).Must(b => string.IsNullOrWhiteSpace(b) || Barcodes.IsValidFormat(b.Trim())).WithMessage(BarcodeMessage);
        RuleFor(x => x.InitialCost).GreaterThanOrEqualTo(0).When(x => x.InitialCost.HasValue).WithMessage("Giá vốn không âm");
        RuleFor(x => x.MinStock).GreaterThanOrEqualTo(0).WithMessage("Tồn tối thiểu không âm");
        RuleFor(x => x.Status).IsInEnum().WithMessage("Trạng thái không hợp lệ");
        RuleFor(x => x.Color).Must(c => string.IsNullOrWhiteSpace(c) || SaveProductGroupRequestValidator.ColorRegex().IsMatch(c))
            .WithMessage("Màu dạng #RRGGBB");
        RuleFor(x => x.ImageUrl).MaximumLength(Product.ImageUrlMaxLength);
        // Giá, hệ số, số đơn vị quy đổi kiểm ở service sau lỗi trường, kèm mã GiaKhongHopLe / DonViQuyDoiKhongHopLe (07 §2.12).

        RuleForEach(x => x.Units).ChildRules(unit =>
        {
            unit.RuleFor(u => u.Name).NotEmpty().WithMessage("Nhập tên đơn vị")
                .MaximumLength(ProductUnit.NameMaxLength).WithMessage($"Tên đơn vị tối đa {ProductUnit.NameMaxLength} ký tự");
            unit.RuleFor(u => u.Barcode).Must(b => string.IsNullOrWhiteSpace(b) || Barcodes.IsValidFormat(b.Trim())).WithMessage(BarcodeMessage);
        });

        // Tên đơn vị trùng trong mặt hàng (kể cả trùng tên đơn vị cơ bản).
        RuleFor(x => x).Custom((request, context) =>
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { request.BaseUnit?.Trim() ?? string.Empty };
            for (var i = 0; i < request.Units.Count; i++)
            {
                var name = request.Units[i].Name?.Trim() ?? string.Empty;
                if (name.Length > 0 && !seen.Add(name))
                    context.AddFailure($"Units[{i}].Name", "Tên đơn vị bị trùng");
            }
        });
    }
}

public sealed class UpdateProductPricesRequestValidator : AppValidator<UpdateProductPricesRequest>
{
    public UpdateProductPricesRequestValidator()
    {
        RuleFor(x => x.Prices).NotEmpty().WithMessage("Nhập giá cần sửa");
    }
}
