using System.ComponentModel.DataAnnotations;

namespace DevAtlas.Api.Dtos;

public record ApplicationUrlDto(int Id, string Environment, string Color, string Url);

public record AppEnvironmentDto(int Id, string Name, int SortOrder, string Color, int UrlCount);

public record ClientDto(int Id, string Name, string Color, int AppCount, bool IsHidden);

// Salida: nunca incluye la password en claro, solo si existe una guardada.
public record DatabaseConnectionDto(
    int Id,
    string Environment,
    string Color,
    string Engine,
    string? Host,
    int? Port,
    string? DatabaseName,
    string? Username,
    bool HasPassword,
    string? SecretRef);

public record UpsertDatabaseConnectionDto(
    [Required, MaxLength(50)] string Environment,
    [Required, MaxLength(40)] string Engine,
    [MaxLength(200)] string? Host,
    int? Port,
    [MaxLength(120)] string? DatabaseName,
    [MaxLength(120)] string? Username,
    // Password en claro: se cifra al guardar. Vacío = no cambiar (en edición).
    string? Password,
    // true para borrar la password guardada.
    bool ClearPassword,
    [MaxLength(300)] string? SecretRef);

public record UpsertClientDto(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(20)] string Color,
    bool IsHidden = false);

public record UpsertEnvironmentDto(
    [Required, MaxLength(50)] string Name,
    int SortOrder,
    [Required, MaxLength(20)] string Color);

public record NameCount(string Name, int Count);

// Acción masiva desde el listado: archive / unarchive / favorite / unfavorite / delete.
public record BulkActionDto([Required] List<Guid> Ids, [Required, MaxLength(20)] string Action);

public record BulkResultDto(int Affected, int NotFound);

public record StatsDto(
    int Total,
    int Favorites,
    int Archived,
    int DistinctStacks,
    int DistinctTags,
    List<NameCount> ByStack,
    List<NameCount> TopTags);

public record ApplicationListItemDto(
    // Id público (Guid): es el que viaja al front y aparece en la URL.
    Guid Id,
    string Name,
    string? Description,
    string? Stack,
    string? RepoPath,
    string? Owner,
    string? Layer,
    bool IsExternal,
    string Status,
    int? ClientId,
    string? ClientName,
    string? ClientColor,
    bool IsFavorite,
    bool IsArchived,
    List<ApplicationUrlDto> Urls,
    List<string> Tags);

public record ApplicationDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string? RepoPath,
    string? Stack,
    string? Notes,
    string? Owner,
    string? Layer,
    bool IsExternal,
    string Status,
    int? ClientId,
    string? ClientName,
    string? ClientColor,
    bool IsFavorite,
    bool IsArchived,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<ApplicationUrlDto> Urls,
    List<DatabaseConnectionDto> Databases,
    List<string> Tags);

public record ApplicationUrlInput(
    [Required, MaxLength(50)] string Environment,
    [Required, MaxLength(2000), HttpUrl] string Url);

public record UpsertApplicationDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1000)] string? Description,
    [MaxLength(500)] string? RepoPath,
    [MaxLength(200)] string? Stack,
    string? Notes,
    [MaxLength(120)] string? Owner,
    [MaxLength(20)] string? Layer,
    bool IsExternal,
    [MaxLength(20)] string? Status,
    [MaxLength(120)] string? Client,
    bool IsFavorite,
    bool IsArchived,
    List<ApplicationUrlInput> Urls,
    List<string> Tags);
