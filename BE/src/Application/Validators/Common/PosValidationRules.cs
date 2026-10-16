using System.Text.RegularExpressions;
using Application.Common.Time;
using Domain.Entities.Pos;
using FluentValidation;

namespace Application.Validators.Common;

/// <summary>Quy tắc kiểm tra dùng chung của POS bán lẻ (câu lỗi đúng chữ 07 §2).</summary>
public static partial class PosValidationRules
{
    public const string PhoneMessage = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0";
    public const string MaxRangeMessage = "Khoảng ngày tối đa 366 ngày";
    public const string ToBeforeFromMessage = "Ngày kết thúc phải sau ngày bắt đầu";
    public const string InvalidDateMessage = "Ngày dạng yyyy-MM-dd";

    public static bool IsPriceValid(decimal price) => price > 0 && price % PosRules.PriceStep == 0;

    public static bool IsPhone(string? phone) => phone is not null && PhoneRegex().IsMatch(phone.Trim());

    /// <summary>SĐT tùy chọn: có thì 10 số, bắt đầu bằng 0.</summary>
    public static IRuleBuilderOptions<T, string?> OptionalVnPhone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(p => string.IsNullOrWhiteSpace(p) || IsPhone(p)).WithMessage(PhoneMessage);

    /// <summary>
    /// Kiểm khoảng ngày <c>from</c>, <c>to</c> (yyyy-MM-dd giờ Việt Nam): đúng định dạng, <c>to</c> không trước <c>from</c>,
    /// tối đa 366 ngày (07 §2).
    /// </summary>
    public static void DateRange<T>(
        this AbstractValidator<T> validator,
        System.Linq.Expressions.Expression<Func<T, string?>> from,
        System.Linq.Expressions.Expression<Func<T, string?>> to,
        bool required = false)
    {
        var getFrom = from.Compile();
        var getTo = to.Compile();

        validator.RuleFor(from)
            .Must(v => VietnamDates.TryParse(v, out _)).When(x => required || !string.IsNullOrWhiteSpace(getFrom(x)))
            .WithMessage(InvalidDateMessage);

        validator.RuleFor(to)
            .Must(v => VietnamDates.TryParse(v, out _)).When(x => required || !string.IsNullOrWhiteSpace(getTo(x)))
            .WithMessage(InvalidDateMessage);

        validator.RuleFor(to)
            .Must((x, _) => !TryRange(getFrom(x), getTo(x), out var f, out var t) || t >= f)
            .WithMessage(ToBeforeFromMessage);

        validator.RuleFor(from)
            .Must((x, _) => !TryRange(getFrom(x), getTo(x), out var f, out var t) || t < f || t.DayNumber - f.DayNumber + 1 <= PosRules.MaxReportDays)
            .WithMessage(MaxRangeMessage);
    }

    private static bool TryRange(string? from, string? to, out DateOnly fromDate, out DateOnly toDate)
    {
        toDate = default;
        return VietnamDates.TryParse(from, out fromDate) & VietnamDates.TryParse(to, out toDate);
    }

    [GeneratedRegex(@"^0\d{9}$")]
    private static partial Regex PhoneRegex();
}
