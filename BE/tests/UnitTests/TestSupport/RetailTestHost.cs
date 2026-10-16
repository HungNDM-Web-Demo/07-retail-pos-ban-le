using Application;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Domain.Entities.System.Users;
using Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace UnitTests.TestSupport;

/// <summary>
/// DI thật của Application + Infrastructure trên SQLite trong bộ nhớ với dữ liệu mẫu <c>demo-data.json</c>.
/// Đồng hồ giả mặc định 06:30 thứ Năm 15/10/2026 giờ Việt Nam: ca sáng hôm nay của thungan2 đang mở, chưa có hóa đơn hôm nay,
/// nên tồn bằng đúng tồn cuối hôm qua (06 §5.3). Seed chạy một lần vào DB mẫu, mỗi test chép DB mẫu (SQLite backup) cho nhanh.
/// </summary>
public sealed class RetailTestHost : IAsyncDisposable
{
    public const string DemoPassword = "Demo@123";

    /// <summary>23:30 UTC 14/10 = 06:30 giờ Việt Nam 15/10/2026.</summary>
    public static readonly DateTimeOffset Start = new(2026, 10, 14, 23, 30, 0, TimeSpan.Zero);

    private static readonly SemaphoreSlim TemplateGate = new(1, 1);
    private static SqliteConnection? _template;

    private readonly SqliteConnection _keepAlive;
    private readonly ServiceProvider _services;

    private RetailTestHost(SqliteConnection keepAlive, ServiceProvider services, FakeTimeProvider time, TestCurrentUser currentUser)
    {
        _keepAlive = keepAlive;
        _services = services;
        Time = time;
        CurrentUser = currentUser;
    }

    public FakeTimeProvider Time { get; }

    public TestCurrentUser CurrentUser { get; }

    public IServiceProvider Services => _services;

    /// <summary>Host dùng bản chép của DB mẫu đã seed lúc <see cref="Start"/>.</summary>
    public static async Task<RetailTestHost> StartAsync()
    {
        var template = await TemplateAsync();
        var (connection, connectionString) = await OpenAsync();
        await TemplateGate.WaitAsync();
        try
        {
            template.BackupDatabase(connection);
        }
        finally
        {
            TemplateGate.Release();
        }

        return await BuildAsync(connection, connectionString, Start);
    }

    /// <summary>Host seed riêng ở thời điểm <paramref name="start"/> (kiểm cách nạp hóa đơn hôm nay theo giờ).</summary>
    public static async Task<RetailTestHost> StartFreshAsync(DateTimeOffset start)
    {
        var (connection, connectionString) = await OpenAsync();
        return await BuildAsync(connection, connectionString, start);
    }

    private static async Task<SqliteConnection> TemplateAsync()
    {
        await TemplateGate.WaitAsync();
        try
        {
            if (_template is null)
            {
                var (connection, connectionString) = await OpenAsync();
                await using var host = await BuildAsync(connection, connectionString, Start, keepConnection: true);
                _template = connection;
            }

            return _template;
        }
        finally
        {
            TemplateGate.Release();
        }
    }

    private static async Task<(SqliteConnection, string)> OpenAsync()
    {
        var connectionString = $"Data Source=retail-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        return (connection, connectionString);
    }

    private static async Task<RetailTestHost> BuildAsync(SqliteConnection connection, string connectionString, DateTimeOffset start, bool keepConnection = false)
    {
        var time = new FakeTimeProvider(start);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["Database:ConnectionString"] = connectionString,
                ["Jwt:Key"] = new string('k', 48),
                ["Jwt:Issuer"] = "unit-test",
                ["Jwt:Audience"] = "unit-test",
                ["Demo:Enabled"] = "true",
                ["Demo:Password"] = DemoPassword
            })
            .Build();

        var currentUser = new TestCurrentUser();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(time);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());
        services.AddSingleton<ICurrentUserService>(currentUser);
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        await provider.InitializeDatabaseAsync();
        return new RetailTestHost(keepConnection ? new SqliteConnection(connectionString) : connection, provider, time, currentUser);
    }

    public async Task<T> RunAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    /// <summary>Gọi service trong scope mới (như một request).</summary>
    public Task<T> CallAsync<TService, T>(Func<TService, Task<T>> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    public Task CallAsync<TService>(Func<TService, Task> action)
        where TService : notnull =>
        RunAsync(async sp =>
        {
            await action(sp.GetRequiredService<TService>());
            return true;
        });

    /// <summary>Truy vấn chỉ đọc qua repository.</summary>
    public Task<T> QueryAsync<TEntity, T>(Func<IQueryable<TEntity>, Task<T>> query)
        where TEntity : Domain.Base.BaseEntity =>
        RunAsync(sp => query(sp.GetRequiredService<IGenericRepository<TEntity>>().QueryNoTracking()));

    /// <summary>Đặt người dùng hiện tại là tài khoản demo <paramref name="username"/>.</summary>
    public async Task<Guid> SignInAsync(string username)
    {
        var userId = await QueryAsync<User, Guid>(q => q.Where(u => u.Username == username).Select(u => u.Id).SingleAsync());
        CurrentUser.Set(userId, username);
        return userId;
    }

    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "UnitTests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

/// <summary>Người dùng hiện tại giả, đổi được giữa các bước test.</summary>
public sealed class TestCurrentUser : ICurrentUserService
{
    public Guid? UserId { get; private set; }
    public string? Username { get; private set; }
    public Guid? SessionId => null;
    public bool IsAuthenticated => UserId.HasValue;
    public string? IpAddress => "127.0.0.1";

    public void Set(Guid? userId, string? username)
    {
        UserId = userId;
        Username = username;
    }
}
