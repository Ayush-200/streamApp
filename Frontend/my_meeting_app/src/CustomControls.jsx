import {
  CallControls,
  CancelCallButton,
  ReactionsButton,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
} from '@stream-io/video-react-sdk';
import { CustomEndCallButton } from './CustomEndCallButton';
const CustomControls = () => {
  return (
     <div className="flex gap-3 justify-center">
      <ToggleAudioPublishingButton className="bg-surface-elevated hover:bg-surface-hover text-text-primary rounded-xl p-3 transition-all duration-300" />
      <ToggleVideoPublishingButton className="bg-surface-elevated hover:bg-surface-hover text-text-primary rounded-xl p-3 transition-all duration-300" />
      <CustomEndCallButton />

    </div>
  )
}

export default CustomControls 