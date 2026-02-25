import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Validators, DateUtils, StorageUtils, MathUtils } from '../js/utils/helpers.js';

describe('Validators', () => {
  describe('isValidExerciseType', () => {
    it('should return true for valid exercise types', () => {
      expect(Validators.isValidExerciseType('pushup')).toBe(true);
      expect(Validators.isValidExerciseType('pullup')).toBe(true);
    });

    it('should return false for invalid exercise types', () => {
      expect(Validators.isValidExerciseType('running')).toBe(false);
      expect(Validators.isValidExerciseType('')).toBe(false);
      expect(Validators.isValidExerciseType(null)).toBe(false);
      expect(Validators.isValidExerciseType(undefined)).toBe(false);
    });
  });

  describe('isValidRepCount', () => {
    it('should return true for valid rep counts', () => {
      expect(Validators.isValidRepCount(1)).toBe(true);
      expect(Validators.isValidRepCount(50)).toBe(true);
      expect(Validators.isValidRepCount(1000)).toBe(true);
    });

    it('should return false for invalid rep counts', () => {
      expect(Validators.isValidRepCount(0)).toBe(false);
      expect(Validators.isValidRepCount(-1)).toBe(false);
      expect(Validators.isValidRepCount(1001)).toBe(false);
      expect(Validators.isValidRepCount('10')).toBe(false);
      expect(Validators.isValidRepCount(null)).toBe(false);
      expect(Validators.isValidRepCount(undefined)).toBe(false);
    });
  });

  describe('isValidUserId', () => {
    it('should return true for valid user IDs', () => {
      expect(Validators.isValidUserId('abc123')).toBe(true);
      expect(Validators.isValidUserId('user-123')).toBe(true);
      expect(Validators.isValidUserId('a')).toBe(true);
    });

    it('should return false for invalid user IDs', () => {
      expect(Validators.isValidUserId('')).toBe(false);
      expect(Validators.isValidUserId(null)).toBe(false);
      expect(Validators.isValidUserId(undefined)).toBe(false);
    });
  });
});

describe('DateUtils', () => {
  beforeEach(() => {
    // Mock Date to get consistent results
    vi.useFakeTimers();
  });

  it('should calculate day of year correctly', () => {
    // Set to January 1st, 2024 (1st day of year)
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    expect(DateUtils.getDayOfYear()).toBe(1);

    // Set to January 2nd, 2024 (2nd day of year)
    vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
    expect(DateUtils.getDayOfYear()).toBe(2);
  });

  it('should format dates correctly', () => {
    vi.setSystemTime(new Date('2024-01-15T12:30:45Z'));
    expect(DateUtils.formatDate(new Date())).toMatch(/Jan 15, 2024/);
  });
});

describe('StorageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getItem', () => {
    it('should get and parse JSON value from localStorage', () => {
      const testValue = { count: 10, type: 'pushup' };
      localStorage.getItem.mockReturnValue(JSON.stringify(testValue));

      const result = StorageUtils.getItem('testKey');
      
      expect(localStorage.getItem).toHaveBeenCalledWith('testKey');
      expect(result).toEqual(testValue);
    });

    it('should return default value when item not found', () => {
      localStorage.getItem.mockReturnValue(null);

      const result = StorageUtils.getItem('nonExistentKey', 'default');
      
      expect(localStorage.getItem).toHaveBeenCalledWith('nonExistentKey');
      expect(result).toBe('default');
    });

    it('should handle JSON parsing errors gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json');
      console.warn = vi.fn();

      const result = StorageUtils.getItem('badKey', 'default');
      
      expect(console.warn).toHaveBeenCalled();
      expect(result).toBe('default');
    });
  });

  describe('setItem', () => {
    it('should stringify and set value in localStorage', () => {
      const testValue = { count: 10 };
      localStorage.setItem.mockImplementation(() => {});

      const result = StorageUtils.setItem('testKey', testValue);
      
      expect(localStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(testValue));
      expect(result).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      console.warn = vi.fn();

      const result = StorageUtils.setItem('testKey', 'value');
      
      expect(console.warn).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('removeItem', () => {
    it('should remove item from localStorage', () => {
      localStorage.removeItem.mockImplementation(() => {});

      const result = StorageUtils.removeItem('testKey');
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('testKey');
      expect(result).toBe(true);
    });

    it('should handle remove errors gracefully', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Remove failed');
      });
      console.warn = vi.fn();

      const result = StorageUtils.removeItem('testKey');
      
      expect(console.warn).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});

describe('MathUtils', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(MathUtils.clamp(5, 0, 10)).toBe(5);
      expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
      expect(MathUtils.clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('calculateTotalReps', () => {
    it('should calculate total reps correctly', () => {
      const userData = { pushup: 100, pullup: 50 };
      expect(MathUtils.calculateTotalReps(userData)).toBe(150);
    });

    it('should handle missing or zero values', () => {
      expect(MathUtils.calculateTotalReps({ pushup: 100 })).toBe(100);
      expect(MathUtils.calculateTotalReps({ pullup: 50 })).toBe(50);
      expect(MathUtils.calculateTotalReps({})).toBe(0);
      expect(MathUtils.calculateTotalReps({ pushup: 0, pullup: 0 })).toBe(0);
    });
  });
});