import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find({ order: { fullName: 'ASC' } });
  }

  async findOne(userId: number): Promise<User> {
    const user = await this.repo.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  /** Ищет пользователя вместе с хешем пароля — только для авторизации. */
  findByLoginWithPassword(login: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.login = :login', { login })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    await this.assertLoginFree(dto.login);
    const user = this.repo.create({
      login: dto.login,
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive ?? true,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    });
    return this.repo.save(user);
  }

  async update(userId: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(userId);
    if (dto.login && dto.login !== user.login) {
      await this.assertLoginFree(dto.login);
      user.login = dto.login;
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    return this.repo.save(user);
  }

  /**
   * Пользователи не удаляются физически: на них ссылаются сделки,
   * активности и журнал действий. Вместо удаления — деактивация.
   */
  async deactivate(userId: number): Promise<User> {
    const user = await this.findOne(userId);
    user.isActive = false;
    return this.repo.save(user);
  }

  private async assertLoginFree(login: string): Promise<void> {
    const exists = await this.repo.exists({ where: { login } });
    if (exists) {
      throw new ConflictException('Пользователь с таким логином уже существует');
    }
  }
}
