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
import { Injectable, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GasService {
  constructor(private ngZone: NgZone) {}

  /**
   * Call a server-side Google Apps Script function.
   * @param functionName Name of the server function
   * @param args Arguments to pass to the function
   */
  async run(functionName: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || !google.script || !google.script.run) {
        console.warn(
          `[GasService] google.script.run is not available (Local Dev Mode). Mocking call to ${functionName}`,
        );
        this.mockCall(functionName, args).then(resolve).catch(reject);
        return;
      }

      google.script.run
        .withSuccessHandler((result: any) => {
          this.ngZone.run(() => resolve(result));
        })
        .withFailureHandler((error: any) => {
          this.ngZone.run(() => reject(error));
        })
        [functionName](...args);
    });
  }

  private async mockCall(functionName: string, args: any[]): Promise<any> {
    // Basic mock implementation for local dev
    console.log(`[Mock] Calling ${functionName} with`, args);

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500));

    switch (functionName) {
      case 'getItemById':
        // Mock returning a creative if asked
        if (args[0] === 'creatives') {
          return {
            data: {
              id: args[1],
              title: 'Mock Creative',
              creative_status_key: 'TODO',
              deadline_at: new Date().toISOString(),
            },
            isCached: false,
          };
        }
        break;
      // Add more mocks as needed
    }
    return null;
  }
}

declare const google: any;
