import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { BuilderAssetsService, BuilderAssetQuery, BrandingUploadFile } from './builder-assets.service';
import { BuilderAssetDto } from './dto/builder-asset.dto';
import { BuilderNodeDefinitionInputDto } from './dto/node-definition.dto';
import { NodeDefinitionListQueryDto } from './dto/node-definition-list-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

type MultipartCapableRequest = FastifyRequest & {
    isMultipart?: () => boolean;
    file?: () => Promise<{
        toBuffer: () => Promise<Buffer>;
        mimetype: string;
        filename: string;
    } | undefined>;
};

@Controller('builder-assets')
@ApiTags('builder-assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class BuilderAssetsController {
    constructor(private readonly service: BuilderAssetsService) {}

    @Post('branding-image')
    async uploadBrandingImage(@Req() req: FastifyRequest): Promise<{ url: string }> {
        const multipartReq = req as MultipartCapableRequest;
        if (!multipartReq.isMultipart?.()) {
            throw new BadRequestException('Expected multipart/form-data');
        }
        const file = await multipartReq.file?.();
        if (!file) {
            throw new BadRequestException('file field is required');
        }
        const buffer = await file.toBuffer();
        const payload: BrandingUploadFile = {
            buffer,
            mimetype: file.mimetype,
            originalname: file.filename,
            size: buffer.length,
        };
        return this.service.uploadBrandingImage(payload);
    }

    @Get('node-palette-categories')
    listNodePaletteCategories() {
        return this.service.listNodePaletteCategories();
    }

    @Get('node-definitions')
    listNodeDefinitions(@Query() query: NodeDefinitionListQueryDto) {
        return this.service.listNodeDefinitions(query);
    }

    @Post('node-definitions')
    createNodeDefinition(@Body() dto: BuilderNodeDefinitionInputDto) {
        return this.service.createNodeDefinition(dto);
    }

    @Get('node-definitions/:id')
    getNodeDefinition(@Param('id', ObjectIdPipe) id: string) {
        return this.service.getNodeDefinition(id);
    }

    @Patch('node-definitions/:id')
    updateNodeDefinition(@Param('id', ObjectIdPipe) id: string, @Body() dto: Partial<BuilderNodeDefinitionInputDto>) {
        return this.service.updateNodeDefinition(id, dto);
    }

    @Get()
    findAll(@Query() query: BuilderAssetQuery) {
        return this.service.findAll(query);
    }

    @Post()
    create(@Body() dto: BuilderAssetDto) {
        return this.service.create(dto);
    }

    @Patch(':id')
    update(@Param('id', ObjectIdPipe) id: string, @Body() dto: Partial<BuilderAssetDto>) {
        return this.service.update(id, dto);
    }

    @Get(':id/usage')
    usage(@Param('id', ObjectIdPipe) id: string) {
        return this.service.usage(id);
    }
}
