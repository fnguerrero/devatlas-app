using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DevAtlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEnvironmentCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Catálogo de ambientes + semilla.
            migrationBuilder.CreateTable(
                name: "Environments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    Color = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Environments", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Environments",
                columns: new[] { "Id", "Color", "Name", "SortOrder" },
                values: new object[,]
                {
                    { 1, "#16a34a", "Dev", 1 },
                    { 2, "#0891b2", "Test", 2 },
                    { 3, "#d97706", "QA", 3 },
                    { 4, "#dc2626", "Prod", 4 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Environments_Name",
                table: "Environments",
                column: "Name",
                unique: true);

            // 2. Nueva columna FK (temporalmente con default 0).
            migrationBuilder.AddColumn<int>(
                name: "EnvironmentId",
                table: "ApplicationUrls",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // 3. Crear ambientes para los nombres que existían en las URLs y no están en la semilla.
            migrationBuilder.Sql(@"
                INSERT INTO ""Environments"" (""Name"", ""SortOrder"", ""Color"")
                SELECT DISTINCT TRIM(au.""Environment""),
                       100 + (SELECT COUNT(*) FROM ""Environments""),
                       '#6b7280'
                FROM ""ApplicationUrls"" au
                WHERE TRIM(au.""Environment"") <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM ""Environments"" e
                      WHERE e.""Name"" = TRIM(au.""Environment"") COLLATE NOCASE);
            ");

            // 4. Mapear cada URL a su ambiente por nombre (fallback: Dev = 1).
            migrationBuilder.Sql(@"
                UPDATE ""ApplicationUrls""
                SET ""EnvironmentId"" = COALESCE(
                    (SELECT e.""Id"" FROM ""Environments"" e
                     WHERE e.""Name"" = TRIM(""ApplicationUrls"".""Environment"") COLLATE NOCASE),
                    1);
            ");

            // 5. Descartar la columna string y crear índice + FK.
            migrationBuilder.DropColumn(
                name: "Environment",
                table: "ApplicationUrls");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationUrls_EnvironmentId",
                table: "ApplicationUrls",
                column: "EnvironmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_ApplicationUrls_Environments_EnvironmentId",
                table: "ApplicationUrls",
                column: "EnvironmentId",
                principalTable: "Environments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApplicationUrls_Environments_EnvironmentId",
                table: "ApplicationUrls");

            migrationBuilder.DropTable(
                name: "Environments");

            migrationBuilder.DropIndex(
                name: "IX_ApplicationUrls_EnvironmentId",
                table: "ApplicationUrls");

            migrationBuilder.DropColumn(
                name: "EnvironmentId",
                table: "ApplicationUrls");

            migrationBuilder.AddColumn<string>(
                name: "Environment",
                table: "ApplicationUrls",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
