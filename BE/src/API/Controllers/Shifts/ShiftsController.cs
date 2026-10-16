using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Shifts;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Shifts;

/// <summary>Ca thu ngân (UC-02, UC-09, UC-10, 07 §2.7).</summary>
[Route("api/shifts")]
public sealed class ShiftsController(IShiftService service) : PosApiController
{
    /// <summary>Ca đang mở của người gọi; chưa có → 204 (FE hiện hộp Mở ca, TC-05, TC-06).</summary>
    [HttpGet("current")]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<ShiftDto>> GetCurrent(CancellationToken ct) =>
        await service.GetCurrentAsync(ct) is { } shift ? Ok(shift) : NoContent();

    /// <summary>Mở ca: 201; đã có ca mở → 200 ca đó (UC-02 E2).</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    public async Task<ActionResult<ShiftDto>> Open(OpenShiftRequest request, CancellationToken ct)
    {
        var result = await service.OpenAsync(request, ct);
        return result.Created ? StatusCode(StatusCodes.Status201Created, result.Shift) : Ok(result.Shift);
    }

    /// <summary>Chốt ca (UC-09); lệch quá 20.000 ₫ mà không ghi chú → 400 CanGhiChu (TC-08).</summary>
    [HttpPost("current/close")]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    public async Task<ActionResult<ShiftDto>> Close(CloseShiftRequest request, CancellationToken ct) =>
        Ok(await service.CloseCurrentAsync(request, ct));

    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Shifts.View)]
    public async Task<ActionResult<PaginatedResult<ShiftDto>>> GetPaged([FromQuery] ShiftQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    /// <summary>Chi tiết ca: người có <c>shifts.view</c> hoặc chính thu ngân của ca.</summary>
    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Shifts.View, ProjectPermissions.Shifts.Operate)]
    public async Task<ActionResult<ShiftDetail>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpPatch("{id:guid}/review")]
    [AuthorizePermission(ProjectPermissions.Shifts.Review)]
    public async Task<ActionResult<ShiftDto>> Review(Guid id, ReviewShiftRequest request, CancellationToken ct) =>
        Ok(await service.ReviewAsync(id, request, ct));
}
