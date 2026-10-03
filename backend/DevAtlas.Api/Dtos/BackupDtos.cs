using System.ComponentModel.DataAnnotations;

namespace DevAtlas.Api.Dtos;

// Formato del backup del workspace. Las passwords viajan CIFRADAS (el blob de Data
// Protection), nunca en claro: para restaurarlas hace falta también la carpeta keys/.
// Sin esa carpeta el backup sigue sirviendo, pero las passwords quedan ilegibles.

public record BackupUrl(string Environment, string Url);

public record BackupDatabase(
    string Environment,
    string Engine,
    string? Host,
    int? Port,
    string? DatabaseName,
    string? Username,
    string? SecretRef,
    string? PasswordEncrypted);

public record BackupApplication(
    string Name,
    string? Description,
    string? RepoPath,
    string? Stack,
    string? Notes,
    string? Owner,
    string? Layer,
    bool IsExternal,
    string Status,
    string? Client,
    bool IsFavorite,
    bool IsArchived,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<string> Tags,
    List<BackupUrl> Urls,
    List<BackupDatabase> Databases);

public record BackupEnvironment(string Name, int SortOrder, string Color);

public record BackupClient(string Name, string Color);

public record BackupFile(
    int Version,
    DateTime ExportedAt,
    string? Workspace,
    List<BackupEnvironment> Environments,
    List<BackupClient> Clients,
    List<BackupApplication> Applications);

public record ImportRequest(
    [Required] BackupFile Backup,
    // "merge" agrega lo que falta y respeta lo existente; "replace" borra el
    // workspace antes de restaurar. El front pide confirmación explícita para replace.
    [RegularExpression("merge|replace")] string Mode = "merge");

public record ImportResultDto(
    int ApplicationsCreated,
    int ApplicationsSkipped,
    int ClientsCreated,
    int EnvironmentsCreated);
