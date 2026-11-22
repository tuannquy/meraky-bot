import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type RepliableInteraction,
} from "discord.js";
import { RepeatMode, type DisTube } from "distube";
import { subcommandMap } from "../commands/meraky.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { CONTROL_PREFIX, REPEAT_LABEL, errorEmbed, successEmbed, type ControlAction } from "../utils/embed.js";
import { UserError, describeError } from "../utils/errors.js";
import { requireQueue } from "../utils/voice.js";

async function replyError(interaction: RepliableInteraction, error: unknown) {
  if (!(error instanceof UserError)) {
    console.error("[interaction] Lỗi khi xử lý lệnh:", error);
  }
  const payload = { embeds: [errorEmbed(describeError(error))], components: [] };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // interaction token expired or message deleted; nothing more to do
  }
}

async function handleControlButton(interaction: ButtonInteraction<"cached">, distube: DisTube) {
  const action = interaction.customId.split(":")[1] as ControlAction;
  const queue = requireQueue(distube, interaction.member);
  let message: string;

  switch (action) {
    case "toggle":
      if (queue.paused) {
        await queue.resume();
        message = "Tiếp tục phát.";
      } else {
        await queue.pause();
        message = "Đã tạm dừng.";
      }
      break;
    case "skip": {
      if (queue.songs.length <= 1 && !queue.autoplay) {
        await queue.stop();
        message = "Đã bỏ qua bài cuối và dừng phát.";
      } else {
        const next = await queue.skip();
        message = `Đã bỏ qua. Tiếp theo: **${next.name ?? "bài kế tiếp"}**`;
      }
      break;
    }
    case "loop": {
      const mode = queue.setRepeatMode();
      message = `Chế độ lặp: **${REPEAT_LABEL[mode as RepeatMode]}**`;
      break;
    }
    case "shuffle":
      if (queue.songs.length < 3) throw new UserError("Cần ít nhất 2 bài đang chờ để xáo trộn.");
      await queue.shuffle();
      message = `Đã xáo trộn ${queue.songs.length - 1} bài trong hàng đợi.`;
      break;
    case "stop":
      await queue.stop();
      distube.voices.leave(interaction.guildId);
      message = "Đã dừng phát và rời kênh thoại.";
      break;
    default:
      return;
  }

  if (action === "toggle" || action === "loop" || action === "shuffle") {
    await refreshNowPlayingControls(queue);
  }
  await interaction.reply({
    embeds: [successEmbed(`${message}\n-# bởi ${interaction.user}`)],
  });
}

export function registerInteractionEvents(client: Client, distube: DisTube) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.inCachedGuild()) {
      if (interaction.isRepliable()) {
        await replyError(interaction, new UserError("Meraky chỉ hoạt động trong server."));
      }
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "meraky") {
      const sub = subcommandMap.get(interaction.options.getSubcommand());
      if (!sub) return;
      try {
        await sub.execute(interaction, distube);
      } catch (error) {
        await replyError(interaction, error);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith(`${CONTROL_PREFIX}:`)) {
      try {
        await handleControlButton(interaction, distube);
      } catch (error) {
        await replyError(interaction, error);
      }
    }
  });
}
