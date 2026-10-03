using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevAtlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationLayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Layer",
                table: "Applications",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Layer",
                table: "Applications");
        }
    }
}
