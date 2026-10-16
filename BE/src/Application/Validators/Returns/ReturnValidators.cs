using Application.DTOs.Returns;
using Application.Validators.Common;
using Domain.Entities.Pos.Returns;
using Domain.Enums.Pos.Returns;
using FluentValidation;

namespace Application.Validators.Returns;

public sealed class CreateReturnRequestValidator : AppValidator<CreateReturnRequest>
{
    public CreateReturnRequestValidator()
    {
        RuleFor(x => x.ClientRequestId).NotEmpty().WithMessage("Thiếu mã yêu cầu").MaximumLength(Return.ClientRequestIdMaxLength);
        RuleFor(x => x.OrderId).NotEmpty().WithMessage("Chọn hóa đơn gốc");
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Chọn ít nhất một dòng trả");
        RuleFor(x => x.RefundMethod).IsInEnum().WithMessage("Hình thức hoàn không hợp lệ");
        RuleFor(x => x.Note).MaximumLength(Return.NoteMaxLength);
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.Condition).IsInEnum().WithMessage("Tình trạng không hợp lệ");
            line.RuleFor(l => l.Reason).IsInEnum().WithMessage("Lý do không hợp lệ");
            line.RuleFor(l => l.Note).NotEmpty().When(l => l.Reason == ReturnReason.Khac).WithMessage("Nhập ghi chú lý do");
            line.RuleFor(l => l.Note).MaximumLength(ReturnLine.NoteMaxLength);
        });
        RuleFor(x => x.Exchange!.Lines).NotEmpty().When(x => x.Exchange is not null)
            .WithMessage("Hóa đơn chưa có hàng").OverridePropertyName("exchange.lines");
    }
}

public sealed class ReturnQueryValidator : AppValidator<ReturnQuery>
{
    public ReturnQueryValidator() => this.DateRange(x => x.From, x => x.To);
}
