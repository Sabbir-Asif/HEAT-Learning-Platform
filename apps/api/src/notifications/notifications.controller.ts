import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import {
  MarkAllNotificationsReadResponseDto,
  NotificationDto,
  NotificationListQueryDto,
  NotificationListResponseDto,
  UnreadNotificationCountDto,
} from "./notifications.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("me/notifications")
@Audience("student")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: NotificationListResponseDto })
  list(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notifications.list(session.userId, query);
  }

  @Get("unread-count")
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: UnreadNotificationCountDto })
  unreadCount(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<UnreadNotificationCountDto> {
    return this.notifications.unreadCount(session.userId);
  }

  @Post("read-all")
  @HttpCode(200)
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  markAllRead(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    return this.notifications.markAllRead(session.userId);
  }

  @Post(":id/read")
  @HttpCode(200)
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @CurrentSession() session: AuthenticatedSession,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(session.userId, id);
  }
}
