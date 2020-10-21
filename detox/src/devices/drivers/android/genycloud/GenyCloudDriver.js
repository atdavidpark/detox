const _ = require('lodash');
const AndroidDriver = require('../AndroidDriver');
const GenyCloudExec = require('./exec/GenyCloudExec');
const RecipesService = require('./services/GenyRecipesService');
const InstanceLookupService = require('./services/GenyInstanceLookupService');
const InstanceLifecycleService = require('./services/GenyInstanceLifecycleService');
const InstanceNaming = require('./services/GenyInstanceNaming');
const AllocationHelper = require('./helpers/GenyAllocationHelper');
const DeviceQueryHelper = require('./helpers/GenyDeviceQueryHelper');
const logger = require('../../../../utils/logger').child({ __filename });

// TODO unit test
class GenyCloudDriver extends AndroidDriver {
  constructor(config) {
    super(config);
    this._name = 'Unspecified Genymotion Cloud Emulator';

    const exec = new GenyCloudExec();
    const instanceNaming = new InstanceNaming(); // TODO should consider a permissive impl for debug/dev mode. Maybe even a custom arg in package.json (Detox > ... > genycloud > sharedAccount: false)
    this.recipeService = new RecipesService(exec, logger);
    this.instanceLookupService = new InstanceLookupService(exec, instanceNaming, this.deviceRegistry);
    this.instanceLifecycleService = new InstanceLifecycleService(exec, instanceNaming);
    this.deviceQueryHelper = new DeviceQueryHelper(this.recipeService);
    this.allocationHelper = new AllocationHelper(this.instanceLookupService, this.instanceLifecycleService);
  }

  get name() {
    return this._name
  }

  async acquireFreeDevice(deviceQuery) {
    const recipe = await this.deviceQueryHelper.getRecipeFromQuery(deviceQuery);

    const cookie = { coldBoot: false };
    const adbName = await this.allocateDevice({
      recipe,
      cookie,
      toString: () => recipe.toString(),
    });

    await this.emitter.emit('bootDevice', { coldBoot: cookie.coldBoot, deviceId: adbName, type: recipe.name});
    await this.adb.apiLevel(adbName);
    await this.adb.disableAndroidAnimations(adbName);

    this._name = `Genycloud-${adbName}`;
    return adbName;
  }

  async doAllocateDevice({ recipe, cookie }) {
    const { instance, coldBooted } = await this.allocationHelper.allocateInstance(recipe.uuid);
    cookie.coldBoot = coldBooted;
    return instance.adbName;
  }
}

module.exports = GenyCloudDriver;
