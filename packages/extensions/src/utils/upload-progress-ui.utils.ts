/**
 * Utility functions for upload progress UI
 * Following Single Responsibility Principle - handles only UI creation
 */

/** CSS ID for upload progress styles */
const UPLOAD_PROGRESS_STYLES_ID = "upload-progress-styles";

/**
 * Creates HTML content for the upload progress widget
 * @param message - Upload status message
 * @param progress - Upload progress percentage (0-100)
 * @returns HTML string for the widget
 */
export function createUploadProgressHtml(message: string, progress: number): string {
  return `
    <div class="upload-skeleton">
      <div class="upload-content">
        <div class="upload-icon">
          <span class="material-symbols-outlined spinning">image</span>
        </div>
        <div class="upload-info">
          <div class="upload-message">${escapeHtml(message)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${clampProgress(progress)}%"></div>
          </div>
          <div class="progress-text">${clampProgress(progress)}%</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Clamps progress value between 0 and 100
 * @param progress - Progress value to clamp
 * @returns Clamped progress value
 */
function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Creates an upload progress widget DOM element
 * @param message - Upload status message
 * @param progress - Upload progress percentage
 * @returns HTMLDivElement containing the widget
 */
export function createUploadProgressWidget(
  message: string,
  progress: number
): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "upload-progress-widget";
  element.innerHTML = createUploadProgressHtml(message, progress);
  return element;
}

/**
 * Updates an existing upload progress widget
 * @param widget - Widget element to update
 * @param message - New message
 * @param progress - New progress value
 */
export function updateUploadProgressWidget(
  widget: Element,
  message: string,
  progress: number
): void {
  widget.innerHTML = createUploadProgressHtml(message, progress);
}

/**
 * CSS styles for upload progress widget
 * Extracted to a constant for maintainability
 */
const UPLOAD_PROGRESS_STYLES = `
  .upload-progress-widget {
    display: block;
    margin: 8px 0;
    max-width: 400px;
  }

  .upload-skeleton {
    background: #f8f9fa;
    border: 2px dashed #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    animation: upload-pulse 2s infinite;
  }

  @keyframes upload-pulse {
    0%, 100% { background-color: #f8f9fa; }
    50% { background-color: #f1f5f9; }
  }

  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .upload-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #e6f3ff;
    border-radius: 50%;
    color: #3182ce;
  }

  .upload-icon .material-symbols-outlined {
    font-size: 24px;
  }

  .upload-icon .spinning {
    animation: upload-spin 1s linear infinite;
  }

  @keyframes upload-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .upload-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 200px;
  }

  .upload-message {
    font-size: 14px;
    color: #4a5568;
    font-weight: 500;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3182ce, #4299e1);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    color: #718096;
    font-weight: 500;
  }
`;

/**
 * Injects upload progress styles into the document if not already present
 * Uses singleton pattern to prevent duplicate style injection
 */
export function injectUploadProgressStyles(): void {
  if (document.querySelector(`#${UPLOAD_PROGRESS_STYLES_ID}`)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = UPLOAD_PROGRESS_STYLES_ID;
  styleElement.textContent = UPLOAD_PROGRESS_STYLES;
  document.head.appendChild(styleElement);
}

/**
 * Finds the upload progress widget element in the document
 * @returns The widget element or null if not found
 */
export function findUploadProgressWidget(): Element | null {
  return document.querySelector(".upload-progress-widget");
}
