import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class CreateItemDto extends createZodDto(
  z.object({
    name: z.string().min(2).max(40),
    quantity: z.number().int().min(1).max(99),
  }),
) {}

export class ListItemsQueryDto extends createZodDto(
  z.object({ page: z.coerce.number().int().min(1).default(1) }),
) {}

export class ItemParamsDto extends createZodDto(z.object({ id: z.string().uuid() })) {}

@Controller("items")
export class ItemsController {
  @Post()
  @ApiCreatedResponse({ type: CreateItemDto })
  create(@Body() body: CreateItemDto): CreateItemDto {
    return body;
  }

  @Get()
  list(@Query() query: ListItemsQueryDto): { page: number } {
    return { page: query.page };
  }

  @Get(":id")
  one(@Param() params: ItemParamsDto): { id: string } {
    return { id: params.id };
  }
}
