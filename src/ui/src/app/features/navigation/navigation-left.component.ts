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
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-navigation-left',
  standalone: true,
  imports: [CommonModule, RouterModule, MatListModule, MatIconModule, MatButtonModule],
  template: `
    <mat-nav-list>
      <header class="nav-header">
        <button mat-fab extended color="primary" routerLink="/home" routerLinkActive="active">
          <mat-icon>home</mat-icon>
          <span>ホーム</span>
        </button>
      </header>

      <a mat-list-item routerLink="/plans" routerLinkActive="active">
        <mat-icon matListItemIcon>folder</mat-icon>
        <div matListItemTitle>企画</div>
      </a>
      <a mat-list-item routerLink="/advertisements" routerLinkActive="active">
        <mat-icon matListItemIcon>campaign</mat-icon>
        <div matListItemTitle>広報</div>
      </a>
      <a mat-list-item routerLink="/creatives" routerLinkActive="active">
        <mat-icon matListItemIcon>palette</mat-icon>
        <div matListItemTitle>制作物</div>
      </a>
      <a mat-list-item routerLink="/budgets" routerLinkActive="active">
        <mat-icon matListItemIcon>currency_yen</mat-icon>
        <div matListItemTitle>お金</div>
      </a>
      <a mat-list-item routerLink="/forms" routerLinkActive="active">
        <mat-icon matListItemIcon>description</mat-icon>
        <div matListItemTitle>フォーム</div>
      </a>
      <a mat-list-item routerLink="/jobs" routerLinkActive="active">
        <mat-icon matListItemIcon>work</mat-icon>
        <div matListItemTitle>当日業務</div>
      </a>
      <a mat-list-item routerLink="/licenses" routerLinkActive="active">
        <mat-icon matListItemIcon>card_membership</mat-icon>
        <!-- Changed from 'license' which might not be standard material icon or requires specific set. using 'card_membership' or similar as fallback? 'license' is valid in outlined fonts? Let's assume standard google fonts icons are loaded -->
        <div matListItemTitle>権利</div>
      </a>
      <a mat-list-item routerLink="/hardwares" routerLinkActive="active">
        <mat-icon matListItemIcon>shelves</mat-icon>
        <div matListItemTitle>備品</div>
      </a>
      <a mat-list-item routerLink="/resources" routerLinkActive="active">
        <mat-icon matListItemIcon>link</mat-icon>
        <div matListItemTitle>リンク集</div>
      </a>
      <a mat-list-item routerLink="/questions" routerLinkActive="active">
        <mat-icon matListItemIcon>help</mat-icon>
        <div matListItemTitle>問合せ</div>
      </a>
    </mat-nav-list>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #f5f5f5; /* Surface color */
        width: 250px;
        border-right: 1px solid #e0e0e0;
      }
      .nav-header {
        padding: 16px;
        display: flex;
        justify-content: center;
      }
      .active {
        background-color: rgba(0, 0, 0, 0.05); /* Highlight active */
      }
    `,
  ],
})
export class NavigationLeftComponent {}
