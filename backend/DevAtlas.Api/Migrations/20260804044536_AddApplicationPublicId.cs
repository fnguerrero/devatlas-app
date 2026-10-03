using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevAtlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationPublicId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PublicId",
                table: "Applications",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Backfill: las apps existentes nacen con Guid vacío, así que hay que darles uno
            // propio ANTES de crear el índice único (si no, choca a partir de la segunda fila).
            // UUID v4 armado con randomblob, que es lo que hay en SQLite.
            migrationBuilder.Sql("""
                UPDATE "Applications"
                SET "PublicId" = lower(
                    hex(randomblob(4)) || '-' ||
                    hex(randomblob(2)) || '-4' ||
                    substr(hex(randomblob(2)), 2) || '-' ||
                    substr('89ab', abs(random()) % 4 + 1, 1) ||
                    substr(hex(randomblob(2)), 2) || '-' ||
                    hex(randomblob(6)))
                WHERE "PublicId" = '00000000-0000-0000-0000-000000000000';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Applications_PublicId",
                table: "Applications",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applications_PublicId",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Applications");
        }
    }
}
