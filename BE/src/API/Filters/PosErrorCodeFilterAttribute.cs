using API.Middlewares;
using Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Lỗi 404, 403 có mã nghiệp vụ (<see cref="ICodedException"/>, 07 §2.12) trả ProblemDetails kèm <c>code</c>.
/// Lỗi khác để <c>ExceptionMiddleware</c> xử lý như thường.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class PosErrorCodeFilterAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.Exception is not ICodedException coded)
            return;

        var status = context.Exception switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ForbiddenException => StatusCodes.Status403Forbidden,
            _ => (int?)null
        };
        if (status is null)
            return;

        var problem = ApiProblemDetails.Create(context.HttpContext, status.Value, context.Exception.Message);
        problem.Extensions["code"] = coded.Code;
        context.Result = new ObjectResult(problem) { StatusCode = status, ContentTypes = { ApiProblemDetails.ContentType } };
        context.ExceptionHandled = true;
    }
}
