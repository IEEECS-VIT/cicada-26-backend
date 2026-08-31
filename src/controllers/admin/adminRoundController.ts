import { Request, Response } from 'express';
import { supabaseRoundRepository } from '../../database/supabase/RoundRepository.js';
import { CreateRoundDto, UpdateRoundDto } from '../../types/round.js';

export const AdminRoundController = {
  createRound: async (req: Request, res: Response): Promise<void> => {
    try {
      const dto = req.body as CreateRoundDto;
      const round = await supabaseRoundRepository.createRound(dto);
      res.status(201).json({ success: true, data: round });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getRounds: async (req: Request, res: Response): Promise<void> => {
    try {
      const rounds = await supabaseRoundRepository.getRounds();
      res.status(200).json({ success: true, data: rounds });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateRound: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const dto = req.body as UpdateRoundDto;
      const round = await supabaseRoundRepository.updateRound(id, dto);
      res.status(200).json({ success: true, data: round });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteRound: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await supabaseRoundRepository.deleteRound(id);
      res.status(200).json({ success: true, message: 'Round deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
