import Svg, { Path } from "react-native-svg";
import {
  chatGPTLogoPath,
  chatGPTLogoViewBox,
} from "../../shared/branding/chatGPT";

export function ChatGPTIcon() {
  return (
    <Svg
      width={21}
      height={21}
      viewBox={chatGPTLogoViewBox}
      fill="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={chatGPTLogoPath} fill="white" />
    </Svg>
  );
}
