using Application.DTOs.Shifts;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Shifts;
using FluentValidation;

namespace Application.Validators.Shifts;

public sealed class OpenShiftRequestValidator : AppValidator<OpenShiftRequest>
{
    public OpenShiftRequestValidator()
    {
        RuleFor(x => x.OpeningCash).NotNull().WithMessage("Nhập tiền đầu ca")
            .GreaterThanOrEqualTo(0).WithMessage("Nhập tiền đầu ca");
    }
}

public sealed class CloseShiftRequestValidator : AppValidator<CloseShiftRequest>
{
    public CloseShiftRequestValidator()
    {
        RuleFor(x => x.CashCount)
            .Must(items => items.All(i => PosRules.Denominations.Contains(i.Denomination) && i.Count >= 0)
                && items.Select(i => i.Denomination).Distinct().Count() == items.Count)
            .WithMessage("Số tờ không hợp lệ");
        RuleFor(x => x.Note).MaximumLength(Shift.NoteMaxLength);
    }
}

public sealed class ReviewShiftRequestValidator : AppValidator<ReviewShiftRequest>
{
    public ReviewShiftRequestValidator()
    {
        RuleFor(x => x.Note).NotEmpty().WithMessage("Nhập ghi chú xử lý").MaximumLength(Shift.NoteMaxLength);
    }
}

public sealed class ShiftQueryValidator : AppValidator<ShiftQuery>
{
    public ShiftQueryValidator() => this.DateRange(x => x.From, x => x.To);
}
