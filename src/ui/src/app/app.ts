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
import { RouterModule } from '@angular/router';
import { NavigationLeftComponent } from './features/navigation/navigation-left.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, NavigationLeftComponent],
  template: `
    <div class="app-container">
      <app-navigation-left class="sidenav"></app-navigation-left>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        height: 100vh;
        overflow: hidden;
      }
      .sidenav {
        width: 250px;
        flex-shrink: 0;
      }
      .main-content {
        flex-grow: 1;
        overflow: auto;
        padding: 16px;
        background-color: #fafafa;
      }
    `,
  ],
})
export class App {}
