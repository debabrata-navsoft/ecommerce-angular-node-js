import { afterNextRender, Component, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

import { Hero } from '../../shared/components/hero/hero';
import { Mobiles } from '../../shared/components/categories/electronics/mobiles/mobiles';
import { TodayDeals } from '../../shared/components/categories/today-deals/today-deals';
import { MoreItems } from '../../shared/components/categories/more-items/more-items';
import { Discount } from '../../shared/components/categories/discount/discount';
import { SmartWatches } from '../../shared/components/categories/electronics/smart-watches/smart-watches';
import { Laptops } from '../../shared/components/categories/electronics/laptops/laptops';
import { Footwear } from '../../shared/components/categories/footwear/footwear';
import { Trending } from '../../shared/components/categories/trending/trending';
import { Headphones } from '../../shared/components/categories/electronics/headphones/headphones';
import { Beauty } from '../../shared/components/categories/beauty/beauty';
import { Jewellery } from '../../shared/components/categories/jewellery/jewellery';
import { BabyKids } from '../../shared/components/categories/baby-kids/baby-kids';
import { HomeLiving } from '../../shared/components/categories/home-living/home-living';
import { Loader } from '../../shared/components/loader/loader';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    RouterLink,
    Hero,
    Mobiles,
    TodayDeals,
    MoreItems,
    Discount,
    SmartWatches,
    Laptops,
    Footwear,
    Trending,
    Headphones,
    Beauty,
    Jewellery,
    BabyKids,
    HomeLiving,
    Loader,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  private platformId = inject(PLATFORM_ID);

  isLoading = signal(true);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    afterNextRender(() => {
      this.isLoading.set(false);
    });
  }

  // private platformId = inject(PLATFORM_ID);
  // private destroyRef = inject(DestroyRef);
  // private loaderService = inject(LoaderService);

  // isLoading = this.loaderService.isLoading;

  // constructor() {
  //   if (!isPlatformBrowser(this.platformId)) {
  //     return;
  //   }

  //   this.loaderService.show();

  //   const timer = setTimeout(() => {
  //     this.loaderService.hide();
  //   }, 1200);

  //   this.destroyRef.onDestroy(() => {
  //     clearTimeout(timer);
  //     this.loaderService.hide();
  //   });
  // }
}
