"use client";

import {
  Controls,
  FullscreenButton,
  Menu,
  MuteButton,
  PlayButton,
  Time,
  TimeSlider,
  VolumeSlider,
  useCaptionsOptions,
  usePlaybackRateOptions,
  useQualityOptions,
} from "@videojs/react";
import {
  CaptionsIcon,
  CheckIcon,
  GaugeIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

const controlButton =
  "text-player-foreground focus-visible:ring-ring inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium outline-none hover:bg-player-foreground/15 focus-visible:ring-3 aria-expanded:bg-player-foreground/15 data-[disabled]:opacity-50";

const menuPopup =
  "bg-popover text-popover-foreground z-20 min-w-36 rounded-lg border p-1 shadow-md outline-none";

const menuItem =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground";

interface OptionMenuProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  valueLabel: string;
  options: readonly { value: string; label: string; disabled: boolean }[];
  onValueChange: (value: string) => void;
}

function OptionMenu({ label, icon, value, valueLabel, options, onValueChange }: OptionMenuProps) {
  return (
    <Menu.Root side="top" align="end">
      <Menu.Trigger
        aria-label={`${label}, ${valueLabel}`}
        className={controlButton}
        render={<button type="button" />}
      >
        {icon}
        <span>{valueLabel}</span>
      </Menu.Trigger>
      <Menu.Popup className={menuPopup}>
        <Menu.Content>
          <Menu.RadioGroup value={value} onValueChange={onValueChange} aria-label={label}>
            {options.map((option) => (
              <Menu.RadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={menuItem}
              >
                <span>{option.label}</span>
                <Menu.ItemIndicator checked={option.value === value} className="size-4">
                  <CheckIcon aria-hidden="true" className="size-4" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Popup>
    </Menu.Root>
  );
}

interface QualityMenuProps {
  onQualityChange: (value: string) => void;
}

function QualityMenu({ onQualityChange }: QualityMenuProps) {
  const quality = useQualityOptions();
  if (quality?.state.availability !== "available") return null;
  return (
    <OptionMenu
      label="Quality"
      icon={<SettingsIcon aria-hidden="true" className="size-4" />}
      value={quality.value}
      valueLabel={quality.selectedLabel}
      options={quality.options}
      onValueChange={(value) => {
        quality.setValue(value);
        onQualityChange(value);
      }}
    />
  );
}

function SpeedMenu() {
  const speed = usePlaybackRateOptions();
  if (speed?.state.availability !== "available") return null;
  return (
    <OptionMenu
      label="Playback speed"
      icon={<GaugeIcon aria-hidden="true" className="size-4" />}
      value={speed.value}
      valueLabel={speed.selectedLabel}
      options={speed.options}
      onValueChange={speed.setValue}
    />
  );
}

function CaptionsMenu() {
  const captions = useCaptionsOptions();
  if (captions?.state.availability !== "available") return null;
  return (
    <OptionMenu
      label="Captions"
      icon={<CaptionsIcon aria-hidden="true" className="size-4" />}
      value={captions.value}
      valueLabel={captions.selectedLabel}
      options={captions.options}
      onValueChange={captions.setValue}
    />
  );
}

interface SliderTrackClasses {
  root: string;
  track: string;
  fill: string;
  thumb: string;
}

const sliderClasses: SliderTrackClasses = {
  root: "group/slider focus-visible:ring-ring relative flex h-5 w-full cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-3",
  track: "bg-player-foreground/30 relative h-1 w-full overflow-hidden rounded-full",
  fill: "bg-player-foreground absolute inset-y-0 left-0 w-(--media-slider-fill)",
  thumb:
    "bg-player-foreground absolute top-1/2 left-(--media-slider-fill) size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
};

function SeekBar() {
  return (
    <TimeSlider.Root className={sliderClasses.root}>
      <TimeSlider.Track className={sliderClasses.track}>
        <TimeSlider.Buffer className="bg-player-foreground/30 absolute inset-y-0 left-0 w-(--media-slider-buffer)" />
        <TimeSlider.Fill className={sliderClasses.fill} />
      </TimeSlider.Track>
      <TimeSlider.Thumb className={sliderClasses.thumb} />
    </TimeSlider.Root>
  );
}

function VolumeControl() {
  return (
    <div className="flex items-center gap-1">
      <MuteButton
        className={controlButton}
        render={(props, state) => (
          <button {...props} type="button" aria-label={state.muted ? "Unmute" : "Mute"}>
            {state.muted ? (
              <VolumeXIcon aria-hidden="true" className="size-4" />
            ) : (
              <Volume2Icon aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      />
      <VolumeSlider.Root className={cn(sliderClasses.root, "hidden w-16 sm:flex")}>
        <VolumeSlider.Track className={sliderClasses.track}>
          <VolumeSlider.Fill className={sliderClasses.fill} />
        </VolumeSlider.Track>
        <VolumeSlider.Thumb className={sliderClasses.thumb} />
      </VolumeSlider.Root>
    </div>
  );
}

interface PlayerControlsProps {
  onQualityChange: (value: string) => void;
}

function PlayerControls({ onQualityChange }: PlayerControlsProps) {
  return (
    <Controls.Root>
      <Controls.Content className="from-player/80 absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t to-transparent px-3 pt-10 pb-2 transition-opacity [&:not([data-visible]):not(:has(:focus-visible))]:opacity-0">
        <SeekBar />
        <Controls.Group aria-label="Playback controls" className="flex items-center gap-1">
          <PlayButton
            className={controlButton}
            render={(props, state) => (
              <button {...props} type="button" aria-label={state.paused ? "Play" : "Pause"}>
                {state.paused ? (
                  <PlayIcon aria-hidden="true" className="size-4" />
                ) : (
                  <PauseIcon aria-hidden="true" className="size-4" />
                )}
              </button>
            )}
          />
          <VolumeControl />
          <Time.Group className="text-player-foreground ml-1 flex items-center gap-1 text-xs tabular-nums">
            <Time.Value type="current" />
            <Time.Separator />
            <Time.Value type="duration" />
          </Time.Group>
          <div className="ml-auto flex items-center gap-1">
            <CaptionsMenu />
            <SpeedMenu />
            <QualityMenu onQualityChange={onQualityChange} />
            <FullscreenButton
              className={controlButton}
              render={(props, state) => (
                <button
                  {...props}
                  type="button"
                  aria-label={state.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {state.fullscreen ? (
                    <MinimizeIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <MaximizeIcon aria-hidden="true" className="size-4" />
                  )}
                </button>
              )}
            />
          </div>
        </Controls.Group>
      </Controls.Content>
    </Controls.Root>
  );
}

export { PlayerControls };
