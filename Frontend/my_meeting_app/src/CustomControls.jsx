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
     <div className="flex gap-4 justify-center">
      <ToggleAudioPublishingButton className="bg-slate-900  hover:bg-black text-white rounded-full p-3 shadow-md" />
      <ToggleVideoPublishingButton className="bg-slate-900 hover:bg-black text-white rounded-full p-3 shadow-md" />
      <CustomEndCallButton />

    </div>
  )
}

export default CustomControls 