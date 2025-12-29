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
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GasService } from '../../core/gas.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-detailed-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './detailed-view.component.html',
  styles: [
    `
      .nav-header {
        display: flex;
        align-items: center;
        padding: 8px;
        gap: 16px;
        background: white;
        border-bottom: 1px solid #ddd;
      }
      .spacer {
        flex: 1;
      }
      .grid-container {
        display: flex;
        gap: 16px;
        padding: 16px;
        height: calc(100vh - 80px);
      }
      .column-left {
        flex: 3;
        overflow-y: auto;
      }
      .column-center {
        flex: 6;
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 8px;
      }
      .column-right {
        flex: 3;
        overflow-y: auto;
      }
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
      }
      .assignees-container {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 16px;
        align-items: center;
      }
      .assignee-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        background: #eee;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .assignee-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tab-content {
        padding: 16px;
        height: 100%;
      }
      .note-item {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #eee;
      }
      .note-header {
        font-size: 0.8em;
        color: #666;
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .note-content {
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ],
})
export class DetailedViewComponent implements OnInit {
  gas = inject(GasService);
  router = inject(Router);

  item: any = null;
  displayId = '';

  // Enums (Should be fetched from backend config)
  statusOptions = [
    { key: 'TODO', value: '未着手' },
    { key: 'IN_PROGRESS', value: '進行中' },
    { key: 'review', value: 'レビュー中' }, // Example mixed naming from legacy? key usually uppercase
    { key: 'DONE', value: '完了' },
  ];
  typeOptions = [
    { key: 'BANNER', value: 'バナー' },
    { key: 'LP', value: 'LP' },
    { key: 'VIDEO', value: '動画' },
  ];
  priorityOptions = [
    { key: 'HIGH', value: '高' },
    { key: 'MEDIUM', value: '中' },
    { key: 'LOW', value: '低' },
  ];

  assignees: any[] = [];
  notes: any[] = [];

  // TODO: Retrieve actual ID from Route params
  currentId = 'mock-id-1';

  ngOnInit() {
    this.fetchData();
  }

  fetchData() {
    // Simulate fetching creative data
    // In real app, we would use this.gas.run('getItemById', 'creatives', this.currentId)
    // For now, using mock inside gas service as well, but here we can define 'mock-id-1' response expectation
    this.gas
      .run('getItemById', 'creatives', this.currentId)
      .then((res: any) => {
        if (res && res.data) {
          this.item = res.data;
          this.displayId = this.item.display_id || '####';
          // Trigger other loads
          this.loadAssignees();
          this.loadNotes();
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }

  updateField(field: string, value: any) {
    console.log(`Updating ${field} to`, value);
    this.gas.run('updateItem', 'creatives', this.currentId, { [field]: value }).then(() => {
      console.log('Update success');
    });
  }

  goBack() {
    // Go to home or previous tab
    this.router.navigate(['/']);
  }

  getClientDisplay() {
    // Logic to resolve client directory name
    return this.item?.client_directory_id || '未設定';
  }

  getContractorDisplay() {
    return this.item?.contractor_directory_id || '未設定';
  }

  selectDirectory(field: string) {
    alert(`ディレクトリ選択モーダルは未実装です (${field})`);
  }

  addMembers() {
    alert('メンバー追加は未実装です');
  }

  addNote() {
    alert('コメント機能は未実装です');
  }

  loadAssignees() {
    // Mock logic
    this.assignees = [
      { name: 'User A', iconUrl: '' },
      { name: 'User B', iconUrl: '' },
    ];
  }

  loadNotes() {
    this.notes = [{ authorName: 'User A', createdAt: new Date(), content: 'テストコメント' }];
  }

  getDocumentContent() {
    // Sanitizer needed for iframe
    if (this.item?.document_gfile_id) {
      return `<iframe src="https://docs.google.com/document/d/${this.item.document_gfile_id}/preview" style="width:100%;height:100%;border:0"></iframe>`;
    }
    return 'ドキュメント設定なし';
  }

  getFolderContent() {
    if (this.item?.gfolder_id) {
      return `<iframe src="https://drive.google.com/embeddedfolderview?id=${this.item.gfolder_id}#list" style="width:100%;height:100%;border:0"></iframe>`;
    }
    return 'フォルダ設定なし';
  }
}
