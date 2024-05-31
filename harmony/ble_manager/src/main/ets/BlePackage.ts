import { RNPackage, TurboModulesFactory } from '@rnoh/react-native-openharmony/ts';
import type {
  TurboModule,
  TurboModuleContext,
  DescriptorWrapperFactoryByDescriptorTypeCtx,
  DescriptorWrapperFactoryByDescriptorType
} from '@rnoh/react-native-openharmony/ts';
import { TM, RNC } from "@rnoh/react-native-openharmony/generated/ts"
import { BleTurboModule } from './BleTurboModule';

class BleTurboModulesFactory extends TurboModulesFactory {
  createTurboModule(name: string): TurboModule | null {
    if (name === 'ReactNativeBleManager' || name === TM.ReactNativeBleManager.NAME) {
      return new BleTurboModule(this.ctx);
    }
    return null;
  }

  hasTurboModule(name: string): boolean {
    return name === 'ReactNativeBleManager' || name === TM.ReactNativeBleManager.NAME;
  }
}

export class BlePackage extends RNPackage {
  createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new BleTurboModulesFactory(ctx);
  }
}
