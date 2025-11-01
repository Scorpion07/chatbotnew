#!/usr/bin/env node

// Configuration validation script
import { validateConfig, config } from './src/services/configService.js';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🔧 TalkSphere AI - Configuration Validation\n'));

// Validate backend configuration
const { warnings, errors } = validateConfig();

// Display configuration summary
console.log(chalk.cyan('📋 Configuration Summary:'));
console.log(`  Server Port: ${config.server.port}`);
console.log(`  Environment: ${config.server.nodeEnv}`);
console.log(`  JWT Secret: ${config.auth.jwtSecret === 'change-this-secret-in-production' ? chalk.yellow('⚠️  Default (change in production)') : chalk.green('✅ Custom')}`);
console.log(`  Database: ${config.database.url}`);

// Check API keys
console.log(chalk.cyan('\n🔑 API Keys Status:'));
Object.entries(config.apiKeys).forEach(([service, key]) => {
  const status = key ? chalk.green('✅ Set') : chalk.gray('❌ Missing');
  console.log(`  ${service.toUpperCase()}: ${status}`);
});

// Show feature flags
console.log(chalk.cyan('\n🚀 Feature Flags:'));
Object.entries(config.features).forEach(([feature, enabled]) => {
  const status = enabled ? chalk.green('✅ Enabled') : chalk.gray('❌ Disabled');
  console.log(`  ${feature}: ${status}`);
});

// Display warnings
if (warnings.length > 0) {
  console.log(chalk.yellow('\n⚠️  Warnings:'));
  warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
}

// Display errors
if (errors.length > 0) {
  console.log(chalk.red('\n❌ Errors:'));
  errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
  process.exit(1);
}

if (warnings.length === 0 && errors.length === 0) {
  console.log(chalk.green('\n✅ Configuration looks good!'));
}

console.log(chalk.blue('\n💡 To update configuration:'));
console.log('  • Backend: Edit .env file');
console.log('  • Frontend: Edit .env.local file');
console.log('  • Restart servers after changes\n');