using API.Filters;

namespace API.Base;

/// <summary>Controller nghiệp vụ POS bán lẻ: như <see cref="BaseApiController"/>, thêm <c>code</c> cho lỗi 404/403 có mã (07 §2.12).</summary>
[PosErrorCodeFilter]
public abstract class PosApiController : BaseApiController
{
}
