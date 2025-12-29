/**
 * Copyright 2025 TEPPei
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  select,
  insert,
  update,
  remove,
  SHEET_NAMES,
  ID_COLUMNS,
} from './database';

// Global variables (will be populated per request in GAS)
const activeUser = Session.getActiveUser().getEmail();

// ============================================
// Web App Entry Point
// ============================================

function doGet() {
  return loadMainApplication();
}

function loadMainApplication() {
  try {
    const html = HtmlService.createTemplateFromFile('ui')
      .evaluate()
      .setTitle('Zen Boards')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return html;
  } catch {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: 'Failed to load application.',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function used by deploy-ui.mjs generated code
function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// Public API (Callable from Client)
// ============================================

function getActiveUser() {
  const userEmail = Session.getActiveUser().getEmail();
  const members = select(SHEET_NAMES.MEMBERS, {
    where: { email: ['=', userEmail] },
  });
  return members.length > 0 ? members[0] : null;
}

// 汎用データ取得
function getItems(tableName: string) {
  // Add specific logic here if needed (e.g. enriching data)
  // For now migrating basic structure
  switch (tableName) {
    case SHEET_NAMES.CREATIVES:
      return select(SHEET_NAMES.CREATIVES, {});
    case SHEET_NAMES.PLANS:
      return select(SHEET_NAMES.PLANS, {});
    case SHEET_NAMES.MEMBERS:
      return select(SHEET_NAMES.MEMBERS, {});
    case SHEET_NAMES.TASKS: {
      // Enrichment example from legacy
      const tasks = select(SHEET_NAMES.TASKS, {});
      return tasks.map((task: any) => {
        task.assignee_name = getMemberName(task.assign_to);
        return task;
      });
    }
    case SHEET_NAMES.KNOWLEDGES:
      return select(SHEET_NAMES.KNOWLEDGES, {});
    default:
      return select(tableName, {});
  }
}

function getItemById(tableName: string, id: string) {
  // Basic implementation
  const idCol = ID_COLUMNS[tableName] || 'id';
  const res = select(tableName, { where: { [idCol]: ['=', id] } });
  const data = res.length > 0 ? res[0] : null;

  // Enrichment logic migrating from legacy
  if (data && tableName === SHEET_NAMES.PLANS) {
    data.creatives = select(SHEET_NAMES.CREATIVES, {
      where: { plan_id: ['=', id] },
    });
  }
  return { data, isCached: false };
}

function createItem(tableName: string, data: any) {
  // Add validation or specific logic here
  if (tableName === SHEET_NAMES.CREATIVES) {
    data.creative_status_key = data.creative_status_key || 'TODO';
    data.priority_key = data.priority_key || 'MEDIUM';
  }
  return insert(activeUser, tableName, data);
}

function updateItem(tableName: string, id: string, data: any) {
  const idCol = ID_COLUMNS[tableName] || 'id';
  const res = update(activeUser, tableName, {
    set: data,
    where: { [idCol]: ['=', id] },
  });
  return res && res.length > 0;
}

function deleteItem(tableName: string, condition: any) {
  // CAUTION: condition translation needed if passing raw object
  const where: any = {};
  Object.keys(condition).forEach(key => (where[key] = ['=', condition[key]]));
  const res = remove(activeUser, tableName, { where: where });
  return res && res.length > 0;
}

// Helper
function getMemberName(id: string) {
  if (!id) return '';
  const res = select(SHEET_NAMES.MEMBERS, { where: { email: ['=', id] } }); // Assuming ID is email as per legacy
  const member = res.length > 0 ? res[0] : null;
  return member ? member.display_name || member.member_name : '';
}

// Expose functions to global scope (required for GAS)
(global as any).doGet = doGet;
(global as any).include = include;
(global as any).getActiveUser = getActiveUser;
(global as any).getItems = getItems;
(global as any).getItemById = getItemById;
(global as any).createItem = createItem;
(global as any).updateItem = updateItem;
(global as any).deleteItem = deleteItem;
