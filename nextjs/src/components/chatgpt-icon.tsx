import {
  chatGPTLogoPath,
  chatGPTLogoViewBox,
} from "@mernmafia/shared/branding/chatGPT";

export function ChatGPTIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox={chatGPTLogoViewBox}
      fill="none"
      className="size-[21px]! shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path d={chatGPTLogoPath} fill="currentColor" />
    </svg>
  );
}
