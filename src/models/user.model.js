import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define(
    'User',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        fullName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'full_name',
        },
        email: {
            type: DataTypes.STRING(254),
            allowNull: false,
            unique: true,
        },
        passwordHash: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'password_hash',
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'student',
        },
        educationLevel: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'education_level',
        },
        institution: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        fieldOfStudy: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field: 'field_of_study',
        },
        resetTokenHash: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'reset_token_hash',
        },
        resetTokenExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'reset_token_expires_at',
        },
        accountStatus: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'active',
            field: 'account_status',
        },
        failedLoginAttempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'failed_login_attempts',
        },
        lockedUntil: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'locked_until',
        },
    },
    {
        tableName: 'users',
        timestamps: true,
        underscored: true,
    }
);

export default User;