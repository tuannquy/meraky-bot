import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import type { DisTube } from "distube";

export type GuildInteraction = ChatInputCommandInteraction<"cached">;

export interface Subcommand {
  name: string;
  description: string;
  /** Adds options to the subcommand; name and description are applied automatically. */
  options?: (sub: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
  execute: (interaction: GuildInteraction, distube: DisTube) => Promise<unknown>;
}
