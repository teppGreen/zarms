const members = [
  {
    id: 1,
    name: "田中 太郎",
    grade: "3年",
    department: "渉外局",
    role: "局員",
    active: true,
    updatedAt: "2026-03-16 09:42",
  },
  {
    id: 2,
    name: "佐藤 花子",
    grade: "2年",
    department: "企画局",
    role: "局長",
    active: true,
    updatedAt: "2026-03-16 08:15",
  },
  {
    id: 3,
    name: "鈴木 一郎",
    grade: "1年",
    department: "会計局",
    role: "局員",
    active: false,
    updatedAt: "2026-03-15 21:05",
  },
  {
    id: 4,
    name: "高橋 美咲",
    grade: "4年",
    department: "総務局",
    role: "副実行委員長",
    active: true,
    updatedAt: "2026-03-15 19:33",
  },
  {
    id: 5,
    name: "伊藤 健",
    grade: "2年",
    department: "広報局",
    role: "局員",
    active: true,
    updatedAt: "2026-03-14 17:48",
  },
];

const FRAME_READY_MESSAGE = "tabulator-frame-ready";
const FRAME_LOG_MESSAGE = "tabulator-frame-log";
const FRAME_ERROR_MESSAGE = "tabulator-frame-error";

let frameReadyPromise = null;

function appendLog(message) {
  const log = document.getElementById("log");
  const timestamp = new Date().toLocaleTimeString("ja-JP");
  log.textContent = `[${timestamp}] ${message}\n${log.textContent}`;
}

function createColumns() {
  return [
    { title: "ID", field: "id", width: 72, hozAlign: "right" },
    { title: "氏名", field: "name", minWidth: 140 },
    { title: "学年", field: "grade", width: 92 },
    { title: "所属", field: "department", minWidth: 120 },
    { title: "役割", field: "role", minWidth: 140 },
    {
      title: "在籍",
      field: "active",
      width: 100,
      hozAlign: "center",
      formatter: "tickCross",
    },
    { title: "更新日時", field: "updatedAt", minWidth: 160 },
  ];
}

function buildOptions() {
  const fitColumns = document.getElementById("fitColumns").checked;
  const stripedRows = document.getElementById("stripedRows").checked;

  return {
    layout: fitColumns ? "fitColumns" : "fitDataStretch",
    pagination: true,
    paginationSize: 10,
    movableColumns: true,
    stripedRows,
  };
}

function buildFrameSrcdoc() {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator.min.css" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #ffffff;
      }

      #members-table {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="members-table"></div>
    <script src="https://unpkg.com/tabulator-tables@6.3.0/dist/js/tabulator.min.js"></script>
    <script>
      let table = null;

      function postToParent(type, message) {
        window.parent.postMessage({ type, message }, "*");
      }

      function buildRuntimeOptions(payload) {
        return {
          data: payload.data,
          reactiveData: true,
          layout: payload.layout,
          pagination: payload.pagination,
          paginationSize: payload.paginationSize,
          movableColumns: payload.movableColumns,
          columns: payload.columns,
          rowFormatter(row) {
            if (!payload.stripedRows) {
              return;
            }
            const rowElement = row.getElement();
            if (row.getPosition() % 2 === 0) {
              rowElement.style.backgroundColor = "#f7f7f7";
            } else {
              rowElement.style.backgroundColor = "#ffffff";
            }
          },
        };
      }

      window.addEventListener("message", (event) => {
        if (!event.data || event.data.type !== "render-tabulator") {
          return;
        }

        const container = document.getElementById("members-table");
        if (table) {
          table.destroy();
          table = null;
        }

        try {
          table = new Tabulator(container, buildRuntimeOptions(event.data.payload));
          postToParent("${FRAME_LOG_MESSAGE}", "Tabulatorを再描画しました");
        } catch (error) {
          postToParent("${FRAME_ERROR_MESSAGE}", error.message || "Tabulator描画に失敗しました");
        }
      });

      window.addEventListener("load", () => {
        postToParent("${FRAME_READY_MESSAGE}", "frame ready");
      });
    </script>
  </body>
</html>`;
}

function ensureFrameReady() {
  if (frameReadyPromise) {
    return frameReadyPromise;
  }

  const frame = document.getElementById("members-table-frame");
  frame.srcdoc = buildFrameSrcdoc();

  frameReadyPromise = new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.source !== frame.contentWindow || !event.data) {
        return;
      }

      if (event.data.type === FRAME_READY_MESSAGE) {
        window.removeEventListener("message", onMessage);
        resolve();
      }
    };

    window.addEventListener("message", onMessage);
  });

  return frameReadyPromise;
}

function renderTable() {
  const frame = document.getElementById("members-table-frame");
  const payload = {
    data: members,
    columns: createColumns(),
    ...buildOptions(),
  };

  return ensureFrameReady().then(() => {
    frame.contentWindow.postMessage({ type: "render-tabulator", payload }, "*");
  });
}

function setupEvents() {
  const rerenderButton = document.getElementById("rerenderButton");
  const fitColumns = document.getElementById("fitColumns");
  const stripedRows = document.getElementById("stripedRows");

  rerenderButton.addEventListener("click", renderTable);
  fitColumns.addEventListener("change", renderTable);
  stripedRows.addEventListener("change", renderTable);
}

function bootstrap() {
  window.addEventListener("message", (event) => {
    const frame = document.getElementById("members-table-frame");
    if (event.source !== frame.contentWindow || !event.data) {
      return;
    }

    if (event.data.type === FRAME_LOG_MESSAGE) {
      appendLog(event.data.message);
    }

    if (event.data.type === FRAME_ERROR_MESSAGE) {
      appendLog(`エラー: ${event.data.message}`);
    }
  });

  setupEvents();
  renderTable().then(() => {
    appendLog("Sandboxを初期化しました");
  });
}

document.addEventListener("DOMContentLoaded", bootstrap);
