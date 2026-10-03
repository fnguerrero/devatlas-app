using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevAtlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationUserNameIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applications_UserId",
                table: "Applications");

            migrationBuilder.CreateIndex(
                name: "IX_Applications_UserId_Name",
                table: "Applications",
                columns: new[] { "UserId", "Name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applications_UserId_Name",
                table: "Applications");

            migrationBuilder.CreateIndex(
                name: "IX_Applications_UserId",
                table: "Applications",
                column: "UserId");
        }
    }
}
