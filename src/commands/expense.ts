import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Interaction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import {
  addExpense,
  getExpenses,
  deleteExpense,
  getTotalExpenses,
  getExpensesByCategory,
  getAllCategories,
} from '../database';
import { checkRolePermission } from '../utils/permissions';

export const expenseCommand = new SlashCommandBuilder()
  .setName('expense')
  .setDescription('Manage expenses')
  .addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('add')
      .setDescription('Add a new expense (opens category selection)')
  )
  .addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('list')
      .setDescription('List all expenses')
      .addIntegerOption((option) =>
        option.setName('limit').setDescription('Number of expenses to show (default: 10)')
      )
  )
  .addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('remove')
      .setDescription('Remove an expense (opens selection menu)')
  )
  .addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('total')
      .setDescription('Show total expenses')
  );

export async function handleExpense(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    await handleAddExpense(interaction);
  } else if (subcommand === 'list') {
    await handleListExpenses(interaction);
  } else if (subcommand === 'remove') {
    await handleRemoveExpense(interaction);
  } else if (subcommand === 'total') {
    await handleTotalExpenses(interaction);
  }
}

async function handleAddExpense(interaction: ChatInputCommandInteraction) {
  try {
    const categories = await getAllCategories();
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('expense_add_category')
      .setPlaceholder('Select a category or create new')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('➕ Create New Category')
          .setValue('__new_category__')
          .setDescription('Add expense with a new category'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📝 No Category')
          .setValue('__no_category__')
          .setDescription('Add expense without a category')
      );

    // Add existing categories
    categories.slice(0, 23).forEach((category: string) => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(category)
          .setValue(category)
          .setDescription(`Use existing category: ${category}`)
      );
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '📋 **Select a category for your expense:**',
      components: [row],
    });
  } catch (error) {
    console.error('Error showing category menu:', error);
    await interaction.reply({
      content: '❌ Failed to load categories. Please try again.',
    });
  }
}

export async function handleCategorySelect(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'expense_add_category') return;

  const selectedCategory = interaction.values[0];
  const isNewCategory = selectedCategory === '__new_category__';
  const noCategory = selectedCategory === '__no_category__';

  const modal = new ModalBuilder()
    .setCustomId(`expense_modal_${selectedCategory}`)
    .setTitle('Add New Expense');

  const amountInput = new TextInputBuilder()
    .setCustomId('expense_amount')
    .setLabel('Amount ($) - Enter POSITIVE number only')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter amount (e.g., 50.00) - DO NOT use negative sign')
    .setRequired(true)
    .setMaxLength(20);

  // Category/Description - one field that serves both purposes
  let categoryInput: TextInputBuilder;
  if (isNewCategory) {
    categoryInput = new TextInputBuilder()
      .setCustomId('expense_category')
      .setLabel('Category (e.g., Dripfeed, TikTok Ads)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter category name')
      .setRequired(true)
      .setMaxLength(100);
  } else if (noCategory) {
    categoryInput = new TextInputBuilder()
      .setCustomId('expense_category')
      .setLabel('Category (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Leave empty for no category')
      .setRequired(false)
      .setMaxLength(100);
  } else {
    // Existing category selected - pre-fill it but allow editing
    categoryInput = new TextInputBuilder()
      .setCustomId('expense_category')
      .setLabel('Category')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(selectedCategory)
      .setValue(selectedCategory)
      .setRequired(false)
      .setMaxLength(100);
  }

  const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
  const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput);
  
  modal.addComponents(firstRow, secondRow);

  await interaction.showModal(modal);
}

export async function handleExpenseModal(interaction: Interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('expense_modal_')) return;

  await interaction.deferReply();

  try {
    const amountStr = interaction.fields.getTextInputValue('expense_amount');
    const categoryValue = interaction.customId.replace('expense_modal_', '');
    
    // Get category from input (serves as both category and description)
    let category: string | undefined;
    const categoryInput = interaction.fields.getTextInputValue('expense_category');
    
    if (categoryValue === '__new_category__') {
      category = categoryInput.trim() || undefined;
    } else if (categoryValue === '__no_category__') {
      category = categoryInput.trim() || undefined;
    } else {
      // Use the input value if provided, otherwise use the selected category
      category = categoryInput.trim() || categoryValue;
    }

    // Remove any negative signs - expenses are always negative
    const cleanAmountStr = amountStr.replace(/[-\$]/g, '').trim();
    const amount = parseFloat(cleanAmountStr);
    
    if (isNaN(amount) || amount <= 0) {
      const errorContainer = new ContainerBuilder();
      errorContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# ❌ Invalid Amount\n\nPlease enter a **positive number only** (e.g., 50.00).\n\n⚠️ **Do NOT use a negative sign** - the system automatically treats all amounts as expenses.')
      );
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [errorContainer],
      });
      return;
    }
    
    // Check if user tried to enter a negative number
    if (amountStr.includes('-')) {
      const errorContainer = new ContainerBuilder();
      errorContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# ❌ Invalid Input\n\nPlease enter a **positive number only**.\n\n⚠️ **Do NOT use a negative sign (-)** - the system automatically treats all amounts as expenses. Just enter the number (e.g., 50.00).')
      );
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [errorContainer],
      });
      return;
    }

    if (!category || category.trim() === '') {
      const errorContainer = new ContainerBuilder();
      errorContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# ❌ Category Required\n\nPlease enter a category name (e.g., Dripfeed, TikTok Ads).')
      );
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [errorContainer],
      });
      return;
    }

    const createdBy = interaction.user.tag;
    const expense = await addExpense({
      amount,
      category,
      createdBy,
    });

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# ✅ Expense Added')
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(interaction.guild?.iconURL() || '')
      );

    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## Expense Details\n\n**Amount:** -$${expense.amount.toFixed(2)}\n**Category:** ${expense.category || 'None'}\n**Expense ID:** #${expense.id}\n**Created By:** ${expense.created_by || 'Unknown'}`)
    );

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error adding expense from modal:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to add expense. Please try again.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}

async function handleRemoveExpense(interaction: ChatInputCommandInteraction) {
  try {
    const expenses = await getExpenses(25);
    
    if (expenses.length === 0) {
      await interaction.reply({
        content: '❌ No expenses found to remove.',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('expense_remove_select')
      .setPlaceholder('Select an expense to remove')
      .setMaxValues(1);

    expenses.forEach((exp) => {
      const categoryText = exp.category || 'No Category';
      const label = `$${exp.amount.toFixed(2)} - ${categoryText.substring(0, 50)}${categoryText.length > 50 ? '...' : ''}`;
      const value = exp.id.toString();
      const description = `ID: #${exp.id}`;
      
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(value)
          .setDescription(description)
      );
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '🗑️ **Select an expense to remove:**',
      components: [row],
    });
  } catch (error) {
    console.error('Error showing remove menu:', error);
    await interaction.reply({
      content: '❌ Failed to load expenses. Please try again.',
    });
  }
}

export async function handleRemoveSelect(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'expense_remove_select') return;

  await interaction.deferUpdate();

  try {
    const expenseId = parseInt(interaction.values[0]);
    const deleted = await deleteExpense(expenseId);

    const container = new ContainerBuilder();

    if (deleted) {
      const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('# ✅ Expense Removed')
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(interaction.user.displayAvatarURL() || '')
        );

      container.addSectionComponents(headerSection);
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`Expense **#${expenseId}** has been successfully removed.`)
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# ❌ Expense Not Found\n\nExpense **#' + expenseId + '** could not be found.')
      );
    }

    await interaction.followUp({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error removing expense:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to remove expense. Please try again.')
    );
    await interaction.followUp({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}

async function handleListExpenses(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const limit = interaction.options.getInteger('limit') || 10;
    const expenses = await getExpenses(limit);

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 📋 Expenses List')
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(interaction.guild?.iconURL() || '')
      );

    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    if (expenses.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('No expenses found.')
      );
    } else {
      const expenseList = expenses
        .map(
          (exp, index) =>
            `${index + 1}. **#${exp.id}** - -$${exp.amount.toFixed(2)} - ${exp.category || 'No Category'} - <t:${Math.floor(exp.created_at.getTime() / 1000)}:R>`
        )
        .join('\n');

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(expenseList)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Large)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`> Showing ${expenses.length} expense${expenses.length !== 1 ? 's' : ''}`)
      );
    }

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error listing expenses:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to list expenses. Please try again.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}

async function handleTotalExpenses(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const total = await getTotalExpenses();
    const byCategory = await getExpensesByCategory();

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 💰 Total Expenses')
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(interaction.guild?.iconURL() || '')
      );

    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## 💸 Total Expenses\n\n**-$${total.toFixed(2)}**`)
    );

    if (byCategory.length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Large)
      );

      const categoryList = byCategory
        .map((cat) => `- **${cat.category || 'Uncategorized'}**: $${cat.total.toFixed(2)}`)
        .join('\n');

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`## 📊 By Category\n\n${categoryList}`)
      );
    }

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error getting total expenses:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to get total expenses. Please try again.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}
