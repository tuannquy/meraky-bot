import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Subcommand } from "../types.js";
import { play } from "../handlers/play.js";
import { pause } from "../handlers/pause.js";
import { resume } from "../handlers/resume.js";
import { stop } from "../handlers/stop.js";
import { skip } from "../handlers/skip.js";
import { queue } from "../handlers/queue.js";
import { loop } from "../handlers/loop.js";
import { shuffle } from "../handlers/shuffle.js";
import { volume } from "../handlers/volume.js";
import { lyrics } from "../handlers/lyrics.js";
import { search } from "../handlers/search.js";
import { playlist } from "../handlers/playlist.js";
import { nowplaying } from "../handlers/nowplaying.js";
import { help } from "../handlers/help.js";

export const subcommands: Subcommand[] = [
  play,
  search,
  playlist,
  pause,
  resume,
  skip,
  stop,
  queue,
  nowplaying,
  loop,
  shuffle,
  volume,
  lyrics,
  help,
];

export const subcommandMap = new Map(subcommands.map((s) => [s.name, s]));

export const merakyCommand = new SlashCommandBuilder()
  .setName("meraky")
  .setDescription("Meraky - phát nhạc YouTube trong kênh thoại")
  .setContexts(InteractionContextType.Guild);

for (const sub of subcommands) {
  merakyCommand.addSubcommand((builder) => {
    builder.setName(sub.name).setDescription(sub.description);
    return sub.options ? sub.options(builder) : builder;
  });
}
