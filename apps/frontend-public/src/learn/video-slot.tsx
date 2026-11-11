import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heat/ui";
import { videoStatusText } from "./learning-view";
import type { LearningModule } from "./learning-view";

export interface VideoSlotProps {
  videos: LearningModule["videos"];
}

export default function VideoSlot({ videos }: VideoSlotProps) {
  return (
    <section aria-label="Videos" className="flex flex-col gap-4">
      {videos.map((video) => (
        <Card key={video.id} size="sm">
          <CardHeader>
            <CardTitle>{video.title}</CardTitle>
            {video.required ? (
              <CardAction>
                <Badge variant="outline">Required</Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Card className="aspect-video items-center justify-center">
              <CardContent>
                <CardDescription role="status">{videoStatusText(video)}</CardDescription>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
