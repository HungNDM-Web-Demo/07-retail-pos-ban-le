using Application.DTOs.Customers;
using Application.DTOs.Reports;
using Application.DTOs.Settings;
using Application.Validators.Common;
using Domain.Entities.Crm.Customers;
using FluentValidation;

namespace Application.Validators.Reports;

/// <summary>Khoảng ngày báo cáo bắt buộc, tối đa 366 ngày (07 §2).</summary>
public sealed class DateRangeQueryValidator : AppValidator<DateRangeQuery>
{
    public DateRangeQueryValidator() => this.DateRange(x => x.From, x => x.To, required: true);
}

public sealed class ProductProfitQueryValidator : AppValidator<ProductProfitQuery>
{
    public ProductProfitQueryValidator()
    {
        this.DateRange(x => x.From, x => x.To, required: true);
        RuleFor(x => x.SortBy).Must(s => s is null or "quantity" or "netRevenue" or "grossProfit")
            .WithMessage("Xếp hạng theo quantity, netRevenue hoặc grossProfit");
    }
}

public sealed class ReturnsReportQueryValidator : AppValidator<ReturnsReportQuery>
{
    public ReturnsReportQueryValidator() => this.DateRange(x => x.From, x => x.To, required: true);
}

public sealed class CreateCustomerRequestValidator : AppValidator<CreateCustomerRequest>
{
    public CreateCustomerRequestValidator()
    {
        RuleFor(x => x.Phone).Must(PosValidationRules.IsPhone).WithMessage(PosValidationRules.PhoneMessage);
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên khách").MaximumLength(Customer.NameMaxLength);
    }
}

/// <summary>
/// Khóa cài đặt riêng của dự án khi <c>PUT /api/settings</c> (giống <c>validateProjectSettings</c> trong
/// FE <c>src/config/setting-labels.ts</c>). Chạy thêm bên cạnh validator nền của cùng request.
/// </summary>
public sealed class ProjectSettingsValidator : AppValidator<UpdateSettingsRequest>
{
    public ProjectSettingsValidator()
    {
        RuleForEach(x => x.Items).ChildRules(item =>
            item.RuleFor(i => i).Custom((setting, context) =>
            {
                var message = Check(setting.Key?.Trim() ?? string.Empty, (setting.Value ?? string.Empty).Trim());
                if (message is not null)
                    context.AddFailure("Value", message);
            }));
    }

    private static string? Check(string key, string value) => key switch
    {
        "Store.Name" when value.Length == 0 => "Nhập tên cửa hàng",
        "Store.BankBin" when !System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{6}$") => "Mã ngân hàng gồm 6 chữ số",
        "Store.BankAccount" when !System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{6,19}$") => "Số tài khoản gồm 6 đến 19 chữ số",
        "Pos.ReceiptPaperSize" when value is not ("80" or "58") => "Khổ giấy là 80 hoặc 58",
        "Pos.AllowNegativeStock" when value is not ("true" or "false") => "Giá trị là true hoặc false",
        "Pos.DefaultOpeningCash" when !System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{1,12}$") => "Tiền đầu ca là số nguyên không âm",
        _ => null
    };
}
