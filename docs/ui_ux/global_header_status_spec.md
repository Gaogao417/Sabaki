# Global Header Status & Notification Specification

## 1. Overview & Goal

The **Global Header Status Indicators** provide a unified, premium hub for monitoring all global and background services within Sabaki. By integrating status indicators directly into the right-hand side of the `GlobalHeader` (adjacent to the KataGo engine indicator), we avoid vertical space clutter from a dedicated footer status bar. 

This status hub acts as both a visual feedback system for background tasks (e.g., auto-syncing FoxWQ games, 101weiqi errors, KataGo loading states) and an interactive quick-access gateway. Clicking any indicator opens its corresponding panel or dashboard.

---

## 2. Layout & Visual Integration

### 2.1 Placement
- **Location**: Right-hand side of `GlobalHeader`, arranged horizontally.
- **Order (Left to Right)**:
  1. **KataGo Engine Status**
  2. **Fox WQ Sync Status**
  3. **101weiqi Sync Status**
  4. **Daily Review Progress**
- **Alignment**: Vertically centered within the header bar.
- **Spacing**: `gap: 16px` between indicators.

```text
+-----------------------------------------------------------------------------+
| [Logo] Play  Problem  Recall  Analysis             [🟢 KataGo] [🔄 Fox] [📋 Review] |
+-----------------------------------------------------------------------------+
```

### 2.2 Aesthetic Specifications
- **Theme Support**: Adaptive dark/light modes.
- **Borders & Backgrounds**:
  - Glassmorphic style for indicators: `background: rgba(255, 255, 255, 0.05)` (dark mode) / `rgba(0, 0, 0, 0.03)` (light mode).
  - Subtle border: `1px solid rgba(255, 255, 255, 0.1)` (dark mode) / `1px solid rgba(0, 0, 0, 0.06)` (light mode).
  - Rounded corners: `border-radius: 6px`.
  - Padding: `padding: 4px 8px`.
- **Typography**: Uses the system sans-serif family (e.g., Inter, Outfit). Font size: `12px` (semibold/medium).

---

## 3. Indicator Matrix & State Definitions

Each indicator transitions through a defined lifecycle based on service states.

### 3.1 KataGo Engine Status
Tracks the local or remote GTP engine process.
* **Idle State (`idle`)**:
  - *Visual*: Gray/muted indicator. `🟢 KataGo` (opacity 0.6).
  - *Interaction*: Opens Engine Console.
* **Loading/Booting State (`starting`)**:
  - *Visual*: Pulsing amber indicator. `⏳ 启动中...` (Color: `hsl(38, 92%, 50%)`).
  - *Interaction*: Opens Engine Console.
* **Ready State (`ready`)**:
  - *Visual*: Bright green indicator. `🟢 就绪` (Color: `hsl(142, 70%, 45%)`).
  - *Interaction*: Opens Engine Console.
* **Error State (`error`)**:
  - *Visual*: Crimson red indicator. `🔴 断开` (Color: `hsl(350, 80%, 55%)`).
  - *Interaction*: Opens Engine Settings / Error logs.

### 3.2 Fox WQ Sync Status
Tracks background synchronization with the FoxWQ game record API.
* **Not Configured State (`disabled`)**:
  - *Visual*: Completely hidden, or highly faded gray icon if hovering: `🦊` (opacity 0.25).
* **Idle/Synced State (`synced`)**:
  - *Visual*: Faded green check. `✓ 野狐` (Color: `hsl(142, 60%, 40%)` with opacity 0.8).
  - *Interaction*: Opens **Fox Game Panel** inside the Management Hub.
* **Syncing State (`syncing`)**:
  - *Visual*: Rotating loader with progress. `🔄 同步 3/20` (Animation: infinite rotate 1.2s linear; text pulsing).
  - *Interaction*: Opens Fox Game Panel.
* **Error State (`error`)**:
  - *Visual*: Warning amber. `⚠ 失败` (Color: `hsl(38, 90%, 55%)`).
  - *Interaction*: Opens Fox Game Panel and reveals sync log.

### 3.3 101weiqi Sync Status
Tracks background synchronization of wrong-answer sets (错题本) with 101weiqi.
* **Not Configured State (`disabled`)**:
  - *Visual*: Completely hidden, or highly faded gray icon if hovering.
* **Idle/Synced State (`synced`)**:
  - *Visual*: Faded green check. `✓ 101 题` (Color: `hsl(142, 60%, 40%)` with opacity 0.8).
  - *Interaction*: Opens **101weiqi Panel** inside the Management Hub.
* **Syncing State (`syncing`)**:
  - *Visual*: Rotating loader with progress. `🔄 同步 12/42`.
  - *Interaction*: Opens 101weiqi Panel.
* **Error State (`error`)**:
  - *Visual*: Warning amber. `⚠ 同步失败`.
  - *Interaction*: Opens 101weiqi Panel.

### 3.4 Review Schedule Status
Tracks the daily flashcard/spaced-repetition review plan.
* **No Tasks State (`idle`)**:
  - *Visual*: Hidden or grayed `📋 今日无复习`.
* **Pending Tasks State (`active`)**:
  - *Visual*: Indigo chip with task count. `📋 今日 5 题` (Color: `hsl(230, 85%, 65%)`).
  - *Interaction*: Opens Dashboard / Review Mode tab.
* **Completed State (`done`)**:
  - *Visual*: Harmonious green chip. `✓ 已完成` (Color: `hsl(142, 70%, 45%)`).
  - *Interaction*: Opens Dashboard.

---

## 4. Toast Notification System

While indicators provide persistent status, **Toasts** offer transient, high-priority feedback for critical sync milestones.

### 4.1 Visual Design
- **Position**: Bottom-right of the screen (`right: 24px`, `bottom: 24px`). Multiple toasts stack vertically with `gap: 8px`.
- **Aesthetics**:
  - Premium glassmorphism styling:
    ```css
    background: rgba(30, 30, 35, 0.85); /* Dark */
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
    ```
  - Standard Slide-in and Fade-out animations.

### 4.2 Toast Trigger & Behavior Rules

#### Success Notification
- **Trigger**: Sparked when a background sync successfully finishes with **new data**.
- **Content**: "野狐对局同步完成，新增 5 条对局" (FoxWQ sync complete, 5 new games added) or "101 错题本同步成功，新增 12 道题目".
- **Lifespan**: Auto-dismisses after **3000ms**.
- **Exit Action**: Fades out and slides slightly downward.

#### Warning / Error Notification
- **Trigger**: Sparked when a background sync fails (e.g., API timeout, invalid session token).
- **Content**: "101 错题同步失败：网络超时" (101weiqi sync failed: network timeout).
- **Lifespan**: **Persistent** (does not auto-dismiss).
- **Interactions**:
  - Contains a close ("X") button on the top-right.
  - Features an inline action button: **"重试" (Retry)**. Clicking "Retry" triggers the sync process again immediately.

---

## 5. Micro-interactions & Animations

To make the interface feel responsive and premium:
- **Hover States**:
  - Transition: `transition: background-color 0.2s ease, transform 0.2s ease`.
  - Effect: Scale up slightly (`transform: scale(1.03)`), background brightens.
- **Spinning Animation (`rotate`)**:
  - Keyframes for rotating loader icon:
    ```css
    @keyframes rotate-sync {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    ```
- **Pulse State (`pulse`)**:
  - For loading/booting states (e.g., KataGo starting):
    ```css
    @keyframes pulse-opacity {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    ```

---

## 6. Accessibility (a11y) & Keyboard Navigation

- **Tab Navigation**: All interactive indicators must have `tabindex="0"`.
- **Keyboard Triggers**: Pressing `Enter` or `Space` on an indicator triggers the click behavior (opens corresponding panel).
- **ARIA Roles**:
  - Each indicator must have `role="button"`.
  - Live status regions for screen readers during background syncs: `aria-live="polite"` on syncing text updates.
  - Labels: e.g., `aria-label="野狐围棋同步状态，已同步，点击打开管理面板"`.
