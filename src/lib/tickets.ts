import { Ticket } from '@prisma/client';
import {
  ActionRowBuilder,
  Guild,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
  StringSelectMenuOptionBuilder,
  PermissionsBitField,
} from 'discord.js';
import db from './db';
import { logger } from './logger';

export type TicketModalField = {
  id: string;
  label: string;
  placeholder: string;
  style: TextInputStyle;
  minLength: number;
  maxLength: number;
};

const TECH_TEAM_ROLE_ID = '1478079313529143489';
const DEV_TEAM_ROLE_ID = '1478079183082098831';

const TECH_TEAM_TICKET_CATEGORIES = new Set(['tech', 'game', 'vps']);
const DEV_TEAM_TICKET_CATEGORIES = new Set(['bug', 'feature']);

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  general: 'General Support',
  tech: 'Technical Support',
  game: 'Game Server',
  vps: 'VPS / Hosting',
  billing: 'Billing',
  bug: 'Bug Report',
  feature: 'Feature Request',
  sales: 'Sales'
};

const TICKET_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  general: 'General questions and support',
  tech: 'Technical issues and troubleshooting',
  game: 'FiveM, Minecraft, Rust server support',
  vps: 'VPS and hosting related issues',
  billing: 'Billing and account support',
  bug: 'Report a bug or issue',
  feature: 'Request a new feature',
  sales: 'Sales, partnership inquiries'
};

const TICKET_CATEGORY_EMOJIS: Record<string, string> = {
  general: '📋',
  tech: '🖥️',
  game: '🎮',
  vps: '🔧',
  billing: '💳',
  bug: '🐛',
  feature: '✨',
  sales: '📞'
};

export const CATEGORY_MODAL_FIELDS: Record<string, TicketModalField[]> = {
  tech: [
    {
      id: 'tech_service',
      label: 'Product / Service',
      placeholder: 'VPS, panel, website, billing panel, etc.',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'tech_issue',
      label: 'Issue Summary',
      placeholder: 'Briefly explain what is broken or not working.',
      style: TextInputStyle.Paragraph,
      minLength: 10,
      maxLength: 1000
    },
    {
      id: 'tech_error',
      label: 'Error Message',
      placeholder: 'Paste the exact error if you have one, otherwise say none.',
      style: TextInputStyle.Paragraph,
      minLength: 2,
      maxLength: 1000
    },
    {
      id: 'tech_tried',
      label: 'What Have You Tried?',
      placeholder: 'Restarted service, reinstalled deps, checked logs, etc.',
      style: TextInputStyle.Paragraph,
      minLength: 2,
      maxLength: 1000
    }
  ],
  game: [
    {
      id: 'game_type',
      label: 'Game / Platform',
      placeholder: 'FiveM, Minecraft, Rust, Hytale, etc.',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'game_setup',
      label: 'Server / Framework',
      placeholder: 'Paper, Forge, QBCore, ESX, Ox, modpack, etc.',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'game_issue',
      label: 'Issue Summary',
      placeholder: 'Explain what is happening with the server.',
      style: TextInputStyle.Paragraph,
      minLength: 10,
      maxLength: 1000
    },
    {
      id: 'game_error',
      label: 'Error / Console Output',
      placeholder: 'Paste logs, console output, or say none.',
      style: TextInputStyle.Paragraph,
      minLength: 2,
      maxLength: 1000
    }
  ],
  sales: [
    {
      id: 'sales_service',
      label: 'Service Interested In',
      placeholder: 'VPS, game hosting, web hosting, custom setup, etc.',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'sales_scope',
      label: 'Budget / Scope',
      placeholder: 'Approx budget, scale, or expected usage.',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'sales_timeline',
      label: 'Timeframe',
      placeholder: 'When do you need this live?',
      style: TextInputStyle.Short,
      minLength: 2,
      maxLength: 100
    },
    {
      id: 'sales_details',
      label: 'What Do You Need?',
      placeholder: 'Describe your requirements, goals, or questions.',
      style: TextInputStyle.Paragraph,
      minLength: 10,
      maxLength: 1000
    }
  ]
};

export function getTicketCategoryEmoji(category: string): string {
  return TICKET_CATEGORY_EMOJIS[category] || '🎫';
}

export function getTicketCategoryLabel(category: string): string {
  return TICKET_CATEGORY_LABELS[category] || `${category.charAt(0).toUpperCase() + category.slice(1)} Ticket`;
}

export function getTicketCategoryOptions(): StringSelectMenuOptionBuilder[] {
  return Object.keys(TICKET_CATEGORY_LABELS).map((category) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(TICKET_CATEGORY_LABELS[category])
      .setValue(category)
      .setEmoji(TICKET_CATEGORY_EMOJIS[category])
      .setDescription(TICKET_CATEGORY_DESCRIPTIONS[category])
  );
}

export async function getTicketHandlerRoleIds(guildId: string, category: string): Promise<string[]> {
  if (TECH_TEAM_TICKET_CATEGORIES.has(category)) {
    return [TECH_TEAM_ROLE_ID];
  }

  if (DEV_TEAM_TICKET_CATEGORIES.has(category)) {
    return [DEV_TEAM_ROLE_ID];
  }

  return await db.getSupportRoles(guildId) || [];
}

export function hasAnyTicketHandlerRole(member: GuildMember, roleIds: string[]): boolean {
  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

export async function canManageTicket(member: GuildMember, ticket: Ticket, allowCreator = true): Promise<boolean> {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  if (allowCreator && member.id === ticket.userId) {
    return true;
  }

  const roleIds = await getTicketHandlerRoleIds(ticket.guildId, ticket.category);
  return hasAnyTicketHandlerRole(member, roleIds);
}

export async function addAssignedOnlineMembersToThread(guild: Guild, thread: ThreadChannel, category: string): Promise<void> {
  const allowedRoleIds = await getTicketHandlerRoleIds(guild.id, category);
  if (allowedRoleIds.length === 0) {
    return;
  }

  const members = await guild.members.fetch({ withPresences: true });

  for (const [, member] of members) {
    const isAssignedTeamMember = hasAnyTicketHandlerRole(member, allowedRoleIds);
    const isOnline = member.presence && member.presence.status !== 'offline';

    if (isAssignedTeamMember && isOnline) {
      try {
        await thread.members.add(member.id);
      } catch (err) {
        logger.warn('Failed to add assigned member to ticket thread', {
          context: 'Tickets',
          error: err,
          threadId: thread.id,
          memberId: member.id,
          category
        });
      }
    }
  }
}

export async function removeOtherAssignedMembersFromThread(
  guild: Guild,
  thread: ThreadChannel,
  category: string,
  keepUserId: string
): Promise<void> {
  const allowedRoleIds = await getTicketHandlerRoleIds(guild.id, category);
  if (allowedRoleIds.length === 0) {
    return;
  }

  const members = await guild.members.fetch();

  for (const [, member] of members) {
    if (member.id === keepUserId) {
      continue;
    }

    if (hasAnyTicketHandlerRole(member, allowedRoleIds)) {
      try {
        await thread.members.remove(member.id);
      } catch (err) {
        logger.warn('Failed to remove assigned member from ticket thread', {
          context: 'Tickets',
          error: err,
          threadId: thread.id,
          memberId: member.id,
          category
        });
      }
    }
  }
}

export function buildTicketModal(category: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${category}`)
    .setTitle(`Create a ${getTicketCategoryLabel(category)} Ticket`);

  const fields = CATEGORY_MODAL_FIELDS[category];

  if (!fields || fields.length === 0) {
    const createMsgInput = new TextInputBuilder()
      .setCustomId('ticket_description_input')
      .setLabel('Describe Your Issue')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Please describe your issue in detail...')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(2000);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(createMsgInput));
    return modal;
  }

  const rows = fields.map((field) => {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style)
      .setPlaceholder(field.placeholder)
      .setRequired(true)
      .setMinLength(field.minLength)
      .setMaxLength(field.maxLength);

    return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  });

  modal.addComponents(...rows);
  return modal;
}

export function buildTicketCreateMessage(interaction: ModalSubmitInteraction, category: string): string {
  const fields = CATEGORY_MODAL_FIELDS[category];

  if (!fields || fields.length === 0) {
    return interaction.fields.getTextInputValue('ticket_description_input');
  }

  return fields
    .map((field) => `**${field.label}**\n${interaction.fields.getTextInputValue(field.id)}`)
    .join('\n\n');
}