import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { applyTenantScope } from '../common/helpers/tenant-scope';
import { paginate } from '../common/helpers/paginate';
import { Product } from './product.entity';
import {
  CreateProductDto,
  QueryProductsDto,
  UpdateProductDto,
} from './product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
  ) {}

  findAll(query: QueryProductsDto, user: AuthUser) {
    const qb = this.repo.createQueryBuilder('product');
    applyTenantScope(qb, user, 'product');
    if (query.currency)
      qb.andWhere('product.currency = :currency', { currency: query.currency });
    if (query.q)
      qb.andWhere('(product.name ILIKE :q OR product.sku ILIKE :q)', {
        q: `%${query.q}%`,
      });
    if (query.isActive !== undefined)
      qb.andWhere('product.isActive = :active', { active: query.isActive });
    return paginate(qb, query, 'product', ['name', 'sku', 'price', 'isActive']);
  }

  async findOne(productId: number, user: AuthUser) {
    const product = await this.repo.findOneBy({
      productId,
      organizationId: user.organizationId,
    });
    if (!product) throw new NotFoundException('Позиция каталога не найдена');
    return product;
  }

  create(dto: CreateProductDto, user: AuthUser) {
    return this.repo.save(
      this.repo.create({ ...dto, organizationId: user.organizationId }),
    );
  }

  async update(productId: number, dto: UpdateProductDto, user: AuthUser) {
    await this.findOne(productId, user);
    const { version, ...changes } = dto;
    const result = await this.repo.update(
      { productId, organizationId: user.organizationId, version },
      { ...changes, version: () => 'version + 1' },
    );
    if (!result.affected)
      throw new ConflictException(
        'Позиция уже изменена. Обновите данные и повторите сохранение',
      );
    return this.findOne(productId, user);
  }
}
