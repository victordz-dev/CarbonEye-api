import { Injectable, Logger } from '@nestjs/common';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.logger.error(`Push token inválido: ${pushToken}`);
      return;
    }

    const messages: ExpoPushMessage[] = [
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
      },
    ];

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Erro ao enviar chunk de notificação: ${(error as Error).message}`);
        }
      }

      this.logger.log(`Notificação Push enviada com sucesso para: ${pushToken}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar Push Notification: ${(error as Error).message}`);
    }
  }
}
